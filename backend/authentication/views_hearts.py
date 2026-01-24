from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone

from authentication.models import UserProfile
from authentication.services.hearts import apply_hearts_regen, hearts_constants, hearts_payload


class UserHeartsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            now = timezone.now()
            profile = apply_hearts_regen(profile, now=now)
            return Response(hearts_payload(profile, now=now))


class UserHeartsDecrementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get("amount", 1)
        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return Response({"error": "amount must be an integer"}, status=400)
        if amount <= 0:
            return Response({"error": "amount must be >= 1"}, status=400)

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            now = timezone.now()
            profile = apply_hearts_regen(profile, now=now)

            max_hearts, _ = hearts_constants(profile)
            hearts = int(profile.hearts or 0)
            if hearts <= 0:
                return Response(hearts_payload(profile, now=now))

            profile.hearts = max(0, hearts - amount)
            profile.hearts_last_refill_at = now
            profile.save(update_fields=["hearts", "hearts_last_refill_at"])
            return Response(hearts_payload(profile, now=now))


class UserHeartsGrantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get("amount", 1)
        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return Response({"error": "amount must be an integer"}, status=400)
        if amount <= 0:
            return Response({"error": "amount must be >= 1"}, status=400)

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            now = timezone.now()
            profile = apply_hearts_regen(profile, now=now)
            max_hearts, _ = hearts_constants(profile)

            profile.hearts = min(max_hearts, int(profile.hearts or 0) + amount)
            if profile.hearts >= max_hearts:
                profile.hearts_last_refill_at = now
            profile.save(update_fields=["hearts", "hearts_last_refill_at"])
            return Response(hearts_payload(profile, now=now))


class UserHeartsRefillView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            now = timezone.now()
            max_hearts, _ = hearts_constants(profile)
            profile.hearts = max_hearts
            profile.hearts_last_refill_at = now
            profile.save(update_fields=["hearts", "hearts_last_refill_at"])
            return Response(hearts_payload(profile, now=now))
