from datetime import timedelta

from django.conf import settings

from authentication.entitlements import get_user_plan, plan_allows
from django.utils import timezone


def hearts_constants(profile=None):
    """
    Keep constants centralized to avoid frontend/backends drifting.

    Rules:
    - max hearts defaults to 5.
    - regen interval defaults to 30 minutes.
    - premium regen interval defaults to 15 minutes.

    Settings overrides:
    - HEARTS_MAX
    - HEARTS_REGEN_SECONDS (standard)
    - HEARTS_REGEN_SECONDS_PREMIUM (premium)
    """
    max_hearts = getattr(settings, "HEARTS_MAX", 5)
    standard_regen_seconds = getattr(settings, "HEARTS_REGEN_SECONDS", 30 * 60)
    premium_regen_seconds = getattr(settings, "HEARTS_REGEN_SECONDS_PREMIUM", 15 * 60)

    is_premium = False
    if profile is not None:
        try:
            plan = get_user_plan(profile.user)
            is_premium = plan_allows(plan, "plus")
        except Exception:
            # Be forgiving: some installs use has_paid to represent premium-like access.
            is_premium = bool(
                getattr(profile, "is_premium", False) or getattr(profile, "has_paid", False)
            )

    regen_seconds = premium_regen_seconds if is_premium else standard_regen_seconds
    return int(max_hearts), int(regen_seconds)


def apply_hearts_regen(profile, now=None):
    """
    Apply time-based regeneration to a UserProfile in-place (and save if changed).
    Regeneration rule: +1 heart every regen interval until max_hearts.
    """
    max_hearts, regen_seconds = hearts_constants(profile)
    if now is None:
        now = timezone.now()

    hearts = int(getattr(profile, "hearts", max_hearts) or 0)
    last = getattr(profile, "hearts_last_refill_at", None) or now

    if hearts >= max_hearts:
        # Keep timestamp fresh so the countdown is stable after a refill.
        if profile.hearts_last_refill_at != now:
            profile.hearts_last_refill_at = now
            profile.hearts = max_hearts
            profile.save(update_fields=["hearts", "hearts_last_refill_at"])
        return profile

    elapsed = max(0, int((now - last).total_seconds()))
    to_add = elapsed // regen_seconds
    if to_add <= 0:
        return profile

    new_hearts = min(max_hearts, hearts + to_add)
    if new_hearts >= max_hearts:
        new_last = now
    else:
        new_last = last + timedelta(seconds=to_add * regen_seconds)

    if new_hearts != hearts or new_last != last:
        profile.hearts = new_hearts
        profile.hearts_last_refill_at = new_last
        profile.save(update_fields=["hearts", "hearts_last_refill_at"])
    return profile


def hearts_payload(profile, now=None):
    max_hearts, regen_seconds = hearts_constants(profile)
    if now is None:
        now = timezone.now()
    hearts = int(getattr(profile, "hearts", max_hearts) or 0)
    last = getattr(profile, "hearts_last_refill_at", None) or now
    next_in = None
    if hearts < max_hearts:
        next_at = last + timedelta(seconds=regen_seconds)
        next_in = max(0, int((next_at - now).total_seconds()))
    return {
        "hearts": hearts,
        "max_hearts": max_hearts,
        "regen_seconds": regen_seconds,
        "last_refill_at": last.isoformat(),
        "next_heart_in_seconds": next_in,
    }
