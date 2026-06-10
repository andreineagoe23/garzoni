from rest_framework import status, viewsets, mixins
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import UserRateThrottle
from django.db import models

from django.contrib.auth.models import User

from authentication.user_display import user_display_dict
from authentication.models import UserProfile, FriendRequest, Referral
from authentication.serializers import (
    FriendRequestSerializer,
    ReferralSerializer,
    UserSearchSerializer,
)
from authentication.throttles import LoginRateThrottle
from authentication.services.referral_rewards import get_unredeemed_promo_for_user
from authentication.services.referrals import ReferralError, try_apply_referral_code
from authentication.services.profile import build_public_profile_payload


class FriendRequestView(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Handle friend request functionality, including sending, accepting, and rejecting requests."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]
    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        return FriendRequest.objects.filter(receiver=self.request.user, status="pending")

    def create(self, request):
        """Send a friend request to another user."""
        receiver_id = request.data.get("receiver")

        if not receiver_id:
            return Response(
                {"error": "Receiver ID is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            receiver = User.objects.get(id=receiver_id)

            if request.user == receiver:
                return Response(
                    {"error": "You cannot send a request to yourself"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_request = FriendRequest.objects.filter(
                sender=request.user, receiver=receiver, status="pending"
            )
            if existing_request.exists():
                return Response(
                    {"error": "Friend request already sent"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            FriendRequest.objects.create(sender=request.user, receiver=receiver)
            return Response(
                {"message": "Friend request sent successfully"},
                status=status.HTTP_201_CREATED,
            )

        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, pk=None):
        """Accept or reject a friend request."""
        action_value = request.data.get("action")

        if action_value not in ["accept", "reject"]:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            friend_request = FriendRequest.objects.get(id=pk, receiver=request.user)

            if action_value == "accept":
                friend_request.status = "accepted"
                friend_request.save()
                return Response({"message": "Friend request accepted."}, status=status.HTTP_200_OK)

            if action_value == "reject":
                friend_request.status = "rejected"
                friend_request.save()
                return Response({"message": "Friend request rejected."}, status=status.HTTP_200_OK)

        except FriendRequest.DoesNotExist:
            return Response(
                {"error": "Friend request not found."}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["get"])
    def get_sent_requests(self, request):
        """Retrieve all friend requests sent by the authenticated user."""
        requests = FriendRequest.objects.filter(sender=request.user)
        serializer = FriendRequestSerializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def get_friends(self, request):
        """Retrieve all accepted friends of the authenticated user."""
        friends_ids = FriendRequest.objects.filter(
            models.Q(sender=request.user, status="accepted")
            | models.Q(receiver=request.user, status="accepted")
        ).values_list("receiver", "sender")

        user_ids = []
        for receiver_id, sender_id in friends_ids:
            if receiver_id != request.user.id:
                user_ids.append(receiver_id)
            if sender_id != request.user.id:
                user_ids.append(sender_id)

        friends = User.objects.filter(id__in=user_ids)
        serializer = UserSearchSerializer(friends, many=True)
        return Response(serializer.data)


class PublicProfileView(APIView):
    """Return public stats for any user by ID (username, avatar, points, streak)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request, user_id):
        try:
            target = User.objects.select_related("profile").get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        payload = build_public_profile_payload(request.user, target)
        return Response(payload)


class ReferralApplyView(APIView):
    """List referral status (GET) or apply a referral code (POST)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        profile = request.user.profile
        referrals_made = Referral.objects.filter(referrer=request.user).select_related(
            "referred_user"
        )
        referral_received = (
            Referral.objects.filter(referred_user=request.user)
            .select_related("referred_user", "referrer")
            .first()
        )
        promo = get_unredeemed_promo_for_user(request.user)
        earned_code = promo[0] if promo else None
        has_earned = Referral.objects.filter(
            models.Q(referrer=request.user) | models.Q(referred_user=request.user),
            reward_status=Referral.REWARD_STATUS_EARNED,
        ).exists()
        earned_redeemed = has_earned and not promo

        payload = {
            "referral_code": profile.referral_code,
            "referrals_made": ReferralSerializer(
                referrals_made, many=True, context={"request": request}
            ).data,
            "referral_received": (
                ReferralSerializer(referral_received, context={"request": request}).data
                if referral_received
                else None
            ),
            "earned_discount_code": earned_code,
            "earned_discount_redeemed": earned_redeemed,
        }
        return Response(payload)

    def post(self, request):
        referral_code = request.data.get("referral_code")

        if not referral_code:
            return Response({"message": "Referral code is required."}, status=400)

        try:
            try_apply_referral_code(request.user, referral_code)
        except ReferralError as exc:
            status_code = 400
            if exc.code == "invalid_code":
                status_code = 404
            return Response({"message": exc.message}, status=status_code)

        return Response({"message": "Referral applied successfully"}, status=200)


class FriendsLeaderboardView(APIView):
    """Retrieve a leaderboard of the authenticated user's friends based on their points."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        """Fetch the top friends of the authenticated user sorted by points."""
        accepted = FriendRequest.objects.filter(
            models.Q(sender=request.user) | models.Q(receiver=request.user),
            status="accepted",
        )
        friend_ids = set()
        for fr in accepted.values_list("sender_id", "receiver_id"):
            friend_ids.update(fr)
        friend_ids.discard(request.user.id)

        friends = (
            User.objects.filter(id__in=friend_ids)
            .select_related("profile")
            .order_by("-profile__points")[:10]
        )

        leaderboard_data = [
            {
                "user": {
                    **user_display_dict(friend, include_id=True),
                    "profile_avatar": friend.profile.profile_avatar,
                },
                "points": friend.profile.points,
            }
            for friend in friends
        ]

        return Response(leaderboard_data)


class ReferralCodeValidationView(APIView):
    """Allow guests to check whether a referral code exists."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def get(self, request):
        referral_code = (request.query_params.get("code") or "").strip()
        if not referral_code:
            return Response(
                {"valid": False, "message": "Referral code is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_valid = UserProfile.objects.filter(referral_code__iexact=referral_code).exists()
        if not is_valid:
            return Response({"valid": False, "message": "Invalid referral code."}, status=200)

        return Response({"valid": True, "message": "Referral code is valid."}, status=200)
