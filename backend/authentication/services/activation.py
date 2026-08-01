"""
New-account activation grants: a small welcome bonus plus a seeded day-1 streak,
so a freshly registered user's first dashboard view isn't a cold zero state
(0 streak, 0 coins) right after they've already done real lesson content in the
pre-auth demo lesson.

Call this from every account-creation path right after the User row is
committed: email/password registration, Google OAuth (web redirect + One Tap),
and Apple Sign In. It never raises — a failure here must never fail the
surrounding auth request.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

WELCOME_BONUS_COINS = Decimal("50.00")


def grant_new_user_activation_bonus(user: "User") -> None:
    """
    Grant a one-time welcome bonus and seed the day-1 streak for a brand-new user.

    - ``grant_reward`` is ledger-idempotent on ``event_key`` (see
      gamification.services.rewards.grant_reward), so a retried registration
      call can never double-grant the bonus.
    - ``UserProfile.update_streak()`` on a profile with no ``last_completed_date``
      (always true here — the profile was just created) sets streak=1 and
      returns immediately; it does not touch the "streak broken" email path,
      which only fires on the reset-after-a-gap branch.
    - Each half is wrapped independently so a failure in one (e.g. the reward
      ledger) doesn't prevent the other (e.g. the streak seed) from applying.
    """
    try:
        from gamification.services.rewards import grant_reward

        grant_reward(
            user,
            f"welcome_bonus:{user.id}",
            points=0,
            coins=WELCOME_BONUS_COINS,
        )
    except Exception:
        logger.warning("welcome_bonus_grant_failed user_id=%s", user.id, exc_info=True)

    try:
        user.profile.update_streak()
    except Exception:
        logger.warning("welcome_streak_seed_failed user_id=%s", user.id, exc_info=True)
