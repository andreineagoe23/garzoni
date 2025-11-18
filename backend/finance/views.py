# finance/views.py
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from django.http import HttpResponse
from decimal import Decimal, InvalidOperation
import logging
import stripe
from django.conf import settings

from finance.models import (
    FinanceFact, UserFactProgress, SimulatedSavingsAccount, Reward,
    UserPurchase, PortfolioEntry, FinancialGoal
)
from finance.serializers import (
    SimulatedSavingsAccountSerializer, RewardSerializer, UserPurchaseSerializer,
    PortfolioEntrySerializer, FinancialGoalSerializer
)
from authentication.models import UserProfile
from gamification.models import MissionCompletion

logger = logging.getLogger(__name__)


class SavingsAccountView(APIView):
    """API view to manage the user's simulated savings account, including retrieving the balance and adding funds."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve the current balance of the user's simulated savings account."""
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            return Response({"balance": float(account.balance)}, status=200)
        except Exception as e:
            logger.error(f"Error getting savings balance: {str(e)}")
            return Response({"error": "Failed to retrieve savings balance"}, status=500)

    def post(self, request):
        """Add funds to the user's simulated savings account and update related missions."""
        try:
            amount = Decimal(str(request.data.get("amount", 0)))
            if amount <= 0:
                return Response({"error": "Amount must be positive"}, status=400)

            today = timezone.now().date()
            user = request.user

            with transaction.atomic():
                # Update savings account
                account, created = SimulatedSavingsAccount.objects.select_for_update().get_or_create(
                    user=user,
                    defaults={'balance': amount}
                )
                if not created:
                    account.balance += amount
                    account.save()

                # Fetch all savings-related missions
                missions = MissionCompletion.objects.select_related('mission').filter(
                    user=user,
                    mission__goal_type="add_savings",
                    status__in=["not_started", "in_progress"]
                )

                for completion in missions:
                    mission_type = completion.mission.mission_type
                    target = Decimal(str(completion.mission.goal_reference.get('target', 100)))

                    # Daily savings: only update once per day
                    if mission_type == "daily":
                        if completion.completed_at is not None and completion.completed_at.date() == today:
                            continue  # Already completed today

                        increment = (amount / target) * 100
                        completion.progress = min(completion.progress + increment, 100)

                        if completion.progress >= 100:
                            completion.status = "completed"
                            completion.completed_at = timezone.now()

                    # Weekly savings: cumulative
                    elif mission_type == "weekly":
                        increment = (amount / target) * 100
                        completion.progress = min(completion.progress + increment, 100)

                        if completion.progress >= 100:
                            completion.status = "completed"
                            completion.completed_at = timezone.now()

                    completion.save()

                return Response({
                    "message": "Savings updated!",
                    "balance": float(account.balance)
                }, status=200)

        except (ValueError, InvalidOperation) as e:
            logger.error(f"Invalid amount: {str(e)}")
            return Response({"error": "Invalid numeric value"}, status=400)
        except Exception as e:
            logger.error(f"Savings error: {str(e)}", exc_info=True)
            return Response({"error": "Server error processing savings"}, status=500)


class FinanceFactView(APIView):
    """API view to manage finance facts, including retrieving unread facts and marking them as read."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retrieve a random unread finance fact for the user."""
        try:
            # Get unread facts
            read_facts = UserFactProgress.objects.filter(
                user=request.user
            ).values_list('fact_id', flat=True)

            fact = FinanceFact.objects.filter(
                is_active=True
            ).exclude(id__in=read_facts).order_by('?').first()

            if not fact:
                return Response(status=204)

            return Response({
                "id": fact.id,
                "text": fact.text,
                "category": fact.category
            }, status=200)

        except Exception as e:
            logger.error(f"Fact fetch error: {str(e)}")
            return Response({"error": "Failed to get finance fact"}, status=500)

    def post(self, request):
        """Mark a finance fact as read and update related missions."""
        try:
            fact_id = request.data.get('fact_id')
            if not fact_id:
                return Response({"error": "Missing fact ID"}, status=400)

            fact = FinanceFact.objects.get(id=fact_id)
            today = timezone.now().date()

            # Prevent duplicate daily fact completion
            already_read_today = UserFactProgress.objects.filter(
                user=request.user,
                read_at__date=today
            ).exists()

            if already_read_today:
                return Response({"message": "You already completed today's finance fact."}, status=200)

            # Log the fact as read
            UserFactProgress.objects.create(user=request.user, fact=fact)

            # Progress both daily and weekly missions
            completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="read_fact",
                status__in=["not_started", "in_progress"]
            )

            for completion in completions:
                if completion.mission.mission_type == "daily":
                    completion.update_progress()  # 100% on 1st fact
                elif completion.mission.mission_type == "weekly":
                    completion.update_progress()  # +20% each time

            return Response({"message": "Fact marked as read!"}, status=200)

        except FinanceFact.DoesNotExist:
            return Response({"error": "Invalid fact ID"}, status=404)
        except Exception as e:
            logger.error(f"Fact completion error: {str(e)}")
            return Response({"error": "Failed to mark fact"}, status=500)


class SavingsGoalCalculatorView(APIView):
    """API view to manage savings goal calculations and update user savings progress."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Handle POST requests to add a specified amount to the user's savings and update related missions."""
        amount = request.data.get("amount", 0)
        try:
            account, _ = SimulatedSavingsAccount.objects.get_or_create(user=request.user)
            account.add_to_balance(amount)

            mission_completions = MissionCompletion.objects.filter(
                user=request.user,
                mission__goal_type="add_savings"
            ).select_related('mission')

            for completion in mission_completions:
                target = completion.mission.goal_reference.get('target', 100)
                progress_increment = (amount / target) * 100
                completion.update_progress(increment=progress_increment, total=100)

            return Response({"message": "Savings updated!"}, status=200)
        except Exception as e:
            logger.error(f"Savings error: {str(e)}")
            return Response({"error": "Savings update failed"}, status=500)


class RewardViewSet(viewsets.ModelViewSet):
    """ViewSet to manage rewards, including retrieving active rewards for shopping or donation."""

    serializer_class = RewardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve rewards filtered by type (shop or donate) if specified."""
        # Get type from query parameters, URL path, or request path
        reward_type = (
            self.request.query_params.get('type') or 
            self.kwargs.get('type', None) or
            self._get_type_from_path()
        )
        queryset = Reward.objects.filter(is_active=True)

        if reward_type in ['shop', 'donate']:
            queryset = queryset.filter(type=reward_type)

        return queryset
    
    def _get_type_from_path(self):
        """Extract reward type from request path."""
        path = self.request.path
        if '/rewards/shop/' in path:
            return 'shop'
        elif '/rewards/donate/' in path:
            return 'donate'
        return None


class UserPurchaseViewSet(viewsets.ModelViewSet):
    """ViewSet to manage user purchases, including listing and creating transactions."""

    serializer_class = UserPurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Retrieve all purchases made by the authenticated user."""
        return UserPurchase.objects.filter(user=self.request.user)

    def create(self, request):
        """Handle POST requests to process a reward purchase for the user."""
        try:
            reward_id = request.data.get('reward_id')
            if not reward_id:
                return Response({"error": "Missing reward_id"}, status=400)

            user_profile = request.user.profile
            reward = Reward.objects.get(id=reward_id, is_active=True)

            # Check if the user has sufficient funds to purchase the reward
            if user_profile.earned_money < reward.cost:
                return Response({"error": "Insufficient funds"}, status=400)

            # Deduct the reward cost from the user's balance and save the purchase
            user_profile.earned_money -= reward.cost
            user_profile.save()

            purchase = UserPurchase.objects.create(
                user=request.user,
                reward=reward
            )

            return Response({
                "message": "Transaction successful!",
                "remaining_balance": float(user_profile.earned_money),
                "purchase": UserPurchaseSerializer(purchase, context={'request': request}).data
            }, status=201)

        except Reward.DoesNotExist:
            return Response({"error": "Reward not found or inactive"}, status=404)
        except Exception as e:
            logger.error(f"Purchase error: {str(e)}")
            return Response({"error": "Server error processing transaction"}, status=500)


class StripeWebhookView(APIView):
    """Handle Stripe webhook events, specifically for processing completed checkout sessions."""

    permission_classes = [AllowAny]

    def post(self, request):
        """Process Stripe webhook payloads and update user payment status."""
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )

            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                user_id = session['client_reference_id']

                with transaction.atomic():
                    user_profile = UserProfile.objects.select_for_update().get(user__id=user_id)
                    if not user_profile.has_paid:
                        user_profile.has_paid = True
                        user_profile.stripe_payment_id = session.get('payment_intent', '')
                        user_profile.save(update_fields=['has_paid', 'stripe_payment_id'])

                        cache.delete_many([
                            f'user_payment_status_{user_id}',
                            f'user_profile_{user_id}'
                        ])

        except Exception as e:
            logger.error(f"Webhook error: {str(e)}")

        return HttpResponse(status=200)


class VerifySessionView(APIView):
    """Verify the payment status of a Stripe checkout session."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Check the payment status of a session and update the user's profile if paid."""
        try:
            session_id = request.data.get('session_id')
            if not session_id or not session_id.startswith('cs_'):
                return Response({"error": "Invalid session ID format"}, status=400)

            stripe.api_key = settings.STRIPE_SECRET_KEY
            session = stripe.checkout.Session.retrieve(
                session_id,
                expand=['payment_intent']
            )

            if session.payment_status == 'paid':
                with transaction.atomic():
                    profile = UserProfile.objects.select_for_update().get(user=request.user)
                    profile.has_paid = True
                    profile.stripe_payment_id = session.payment_intent.id if session.payment_intent else ''
                    profile.save(update_fields=['has_paid', 'stripe_payment_id'])
                    cache.set(f'user_payment_status_{request.user.id}', 'paid', 300)
                    return Response({"status": "verified"})

            return Response({"status": "pending"}, status=202)
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {str(e)}")
            return Response({"error": "Payment verification failed"}, status=400)
        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return Response({"error": "Server error"}, status=500)


class PortfolioViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PortfolioEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        portfolio = self.get_queryset()
        total_value = sum(entry.calculate_value() for entry in portfolio)
        total_gain_loss = sum(entry.calculate_gain_loss() for entry in portfolio)
        
        # Calculate allocation by asset type
        allocation = {}
        for entry in portfolio:
            value = entry.calculate_value()
            if entry.asset_type not in allocation:
                allocation[entry.asset_type] = 0
            allocation[entry.asset_type] += value

        return Response({
            'total_value': total_value,
            'total_gain_loss': total_gain_loss,
            'allocation': allocation
        })


class FinancialGoalViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialGoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return FinancialGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_funds(self, request, pk=None):
        goal = self.get_object()
        amount = Decimal(request.data.get('amount', 0))
        
        if amount <= 0:
            return Response(
                {'error': 'Amount must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )

        goal.current_amount += amount
        goal.save()

        # Check if goal is completed
        if goal.current_amount >= goal.target_amount:
            # Award points for completing a goal
            user_profile = request.user.profile
            user_profile.add_points(100)
            user_profile.save()

        return Response(self.get_serializer(goal).data)

