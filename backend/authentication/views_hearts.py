from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from authentication.models import UserProfile
from authentication.entitlements import get_plan_from_profile, plan_allows
from authentication.services.hearts import (
    apply_hearts_regen,
    hearts_constants,
    hearts_payload,
)
from authentication.throttles import HeartsGrantRateThrottle, HeartsRefillRateThrottle


# Free (starter) users get a small number of *instant* refills per day so the
# hearts scarcity mechanic has teeth; Plus/Pro are effectively unlimited (still
# bounded by the outer HeartsRefillRateThrottle). Overridable via settings.
FREE_REFILL_DAILY_CAP = getattr(settings, "HEARTS_FREE_REFILL_DAILY_CAP", 3)


def _refill_cap_cache_key(user_id, day):
    return f"hearts_refill_count:{user_id}:{day.isoformat()}"


def _profile_is_premium(profile) -> bool:
    """True when the profile's plan is Plus or Pro (no per-plan refill cap).

    Takes the profile object directly (not `user.profile`) — the view already
    holds a freshly `select_for_update`-queried profile, and `user.profile`
    can be a stale cached descriptor (e.g. set by the post_save signal at
    account creation, never refreshed after a later billing update mutates a
    different Python instance of the same row).
    """
    try:
        return plan_allows(get_plan_from_profile(profile), "plus")
    except Exception:
        return False


def _refills_used_today(user_id, now) -> int:
    return int(cache.get(_refill_cap_cache_key(user_id, now.date())) or 0)


def _record_refill(user_id, now):
    """Increment today's instant-refill counter (expires after 48h)."""
    key = _refill_cap_cache_key(user_id, now.date())
    try:
        # cache.add is a no-op if the key already exists, so incr always works.
        cache.add(key, 0, timeout=60 * 60 * 48)
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=60 * 60 * 48)


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
    throttle_classes = [HeartsGrantRateThrottle]

    def post(self, request):
        amount = request.data.get("amount", 1)
        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return Response({"error": "amount must be an integer"}, status=400)
        if amount <= 0:
            return Response({"error": "amount must be >= 1"}, status=400)
        amount = min(amount, 1)

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            now = timezone.now()
            profile = apply_hearts_regen(profile, now=now)
            max_hearts, _ = hearts_constants(profile)
            hearts = int(profile.hearts or 0)
            if hearts > 0:
                return Response(
                    {"error": "Hearts can only be granted when you are out of hearts"},
                    status=400,
                )

            profile.hearts = min(max_hearts, hearts + amount)
            if profile.hearts >= max_hearts:
                profile.hearts_last_refill_at = now
            profile.save(update_fields=["hearts", "hearts_last_refill_at"])
            return Response(hearts_payload(profile, now=now))


class UserHeartsRefillView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [HeartsRefillRateThrottle]

    def post(self, request):
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            now = timezone.now()
            profile = apply_hearts_regen(profile, now=now)
            max_hearts, _ = hearts_constants(profile)
            hearts = int(profile.hearts or 0)
            if hearts >= max_hearts:
                # Already full — no-op, no cap consumed.
                return Response(hearts_payload(profile, now=now))

            # Plan-aware daily cap on *instant* refills (free users only). This is
            # what gives the scarcity mechanic teeth and the upgrade CTA a payoff.
            is_premium = _profile_is_premium(profile)
            if not is_premium:
                used_today = _refills_used_today(request.user.pk, now)
                if used_today >= FREE_REFILL_DAILY_CAP:
                    return Response(
                        {
                            "detail": (
                                "You've used all your free heart refills for today. "
                                "Upgrade to Plus for faster, unlimited refills."
                            ),
                            "upgrade_hint": True,
                            "refill_daily_cap": FREE_REFILL_DAILY_CAP,
                            "refills_used_today": used_today,
                        },
                        status=429,
                    )

            profile.hearts = max_hearts
            profile.hearts_last_refill_at = now
            profile.save(update_fields=["hearts", "hearts_last_refill_at"])

            if not is_premium:
                _record_refill(request.user.pk, now)

            return Response(hearts_payload(profile, now=now))
