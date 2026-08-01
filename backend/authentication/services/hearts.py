from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import transaction

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


def grant_single_heart_if_empty(profile, now=None):
    """
    Grant exactly +1 heart, but only when the profile is currently at 0 hearts.

    Shared by UserHeartsGrantView (client-requested grant while empty) and the
    practice-to-earn mechanic below, so there is exactly one place that ever
    increments hearts outside of time-based regen. Returns True if a heart was
    granted, False if the profile already had hearts (no-op).
    """
    if now is None:
        now = timezone.now()
    max_hearts, _ = hearts_constants(profile)
    hearts = int(getattr(profile, "hearts", 0) or 0)
    if hearts > 0:
        return False
    profile.hearts = min(max_hearts, hearts + 1)
    if profile.hearts >= max_hearts:
        profile.hearts_last_refill_at = now
    profile.save(update_fields=["hearts", "hearts_last_refill_at"])
    return True


# --- Practice-to-earn hearts -------------------------------------------------
#
# Third escape from 0 hearts (besides waiting for regen or the capped instant
# refill): keep answering review-queue exercises correctly. Every
# HEARTS_PRACTICE_CORRECT_NEEDED correct review answers submitted *while at 0
# hearts* earns back 1 heart via grant_single_heart_if_empty, capped at
# HEARTS_PRACTICE_DAILY_CAP earned hearts per day. Mirrors the cache-counter
# pattern used for HEARTS_FREE_REFILL_DAILY_CAP in views_hearts.py.

_PRACTICE_CACHE_TIMEOUT = 60 * 60 * 48  # 48h, well past a single UTC day


def hearts_practice_correct_needed() -> int:
    return int(getattr(settings, "HEARTS_PRACTICE_CORRECT_NEEDED", 2))


def hearts_practice_daily_cap() -> int:
    return int(getattr(settings, "HEARTS_PRACTICE_DAILY_CAP", 2))


def _practice_progress_cache_key(user_id, day) -> str:
    return f"hearts_practice_progress:{user_id}:{day.isoformat()}"


def _practice_granted_cache_key(user_id, day) -> str:
    return f"hearts_practice_granted:{user_id}:{day.isoformat()}"


def _incr_cache_counter(key: str) -> int:
    """Same add-then-incr pattern as views_hearts._record_refill."""
    try:
        cache.add(key, 0, timeout=_PRACTICE_CACHE_TIMEOUT)
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=_PRACTICE_CACHE_TIMEOUT)
        return 1


def hearts_practice_progress(user_id, now=None) -> dict:
    """Read-only snapshot of today's practice-to-earn progress for user_id."""
    if now is None:
        now = timezone.now()
    day = now.date()
    return {
        "correct_needed": hearts_practice_correct_needed(),
        "correct_so_far": int(cache.get(_practice_progress_cache_key(user_id, day)) or 0),
        "granted_today": int(cache.get(_practice_granted_cache_key(user_id, day)) or 0),
        "daily_cap": hearts_practice_daily_cap(),
    }


def record_correct_review_answer_for_hearts(user, now=None) -> dict | None:
    """
    Call this after a CORRECT answer to a review-queue exercise. Only counts
    toward the counter while the user is actually out of hearts right now —
    correct answers submitted while hearts > 0 are a no-op and return None, so
    they never contribute to (or reset) the practice counter.

    Server-verified by construction: this re-reads and locks the profile row
    itself (applying time-based regen first) rather than trusting any
    hearts-are-zero claim from the caller/client.

    Returns the post-update progress payload (see hearts_practice_progress),
    or None if hearts were not 0.
    """
    if now is None:
        now = timezone.now()
    day = now.date()

    from authentication.models import UserProfile

    with transaction.atomic():
        profile = UserProfile.objects.select_for_update().get(user=user)
        profile = apply_hearts_regen(profile, now=now)
        if int(profile.hearts or 0) > 0:
            return None

        cap = hearts_practice_daily_cap()
        needed = hearts_practice_correct_needed()
        granted_key = _practice_granted_cache_key(user.id, day)
        progress_key = _practice_progress_cache_key(user.id, day)

        granted_today = int(cache.get(granted_key) or 0)
        if granted_today >= cap:
            # Daily cap already reached — nothing left to earn today, so don't
            # bother advancing the counter either.
            return {
                "correct_needed": needed,
                "correct_so_far": int(cache.get(progress_key) or 0),
                "granted_today": granted_today,
                "daily_cap": cap,
            }

        correct_so_far = _incr_cache_counter(progress_key)

        if correct_so_far >= needed:
            cache.set(progress_key, 0, timeout=_PRACTICE_CACHE_TIMEOUT)
            correct_so_far = 0
            if grant_single_heart_if_empty(profile, now=now):
                granted_today = _incr_cache_counter(granted_key)

    return {
        "correct_needed": needed,
        "correct_so_far": correct_so_far,
        "granted_today": granted_today,
        "daily_cap": cap,
    }
