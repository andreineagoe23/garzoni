"""Business logic for persistent XP-race duels."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.contrib.auth.models import User
from django.db import models, transaction
from django.utils import timezone

from authentication.user_display import user_display_dict
from authentication.models import UserProfile
from gamification.models import Duel
from gamification.services.rewards import grant_reward

MAX_ACTIVE_DUELS_PER_USER = 3
PAIR_COOLDOWN_MINUTES = 60

DURATION_BONUS_XP = {
    24: 100,
    72: 250,
    168: 500,
}

ALLOWED_DURATIONS = set(DURATION_BONUS_XP.keys())


class DuelError(Exception):
    code = "duel_error"

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        if code:
            self.code = code


@dataclass
class DuelSnapshot:
    duel: Duel
    challenger_xp_current: int
    opponent_xp_current: int

    @property
    def challenger_delta(self) -> int:
        return max(0, self.challenger_xp_current - self.duel.challenger_xp_start)

    @property
    def opponent_delta(self) -> int:
        return max(0, self.opponent_xp_current - self.duel.opponent_xp_start)


def _active_or_pending_count(user: User) -> int:
    return Duel.objects.filter(
        models.Q(challenger=user) | models.Q(opponent=user),
        status__in=[Duel.STATUS_PENDING, Duel.STATUS_ACTIVE],
    ).count()


def _recent_pair_cooldown(challenger: User, opponent: User) -> bool:
    cutoff = timezone.now() - timedelta(minutes=PAIR_COOLDOWN_MINUTES)
    return Duel.objects.filter(
        models.Q(challenger=challenger, opponent=opponent)
        | models.Q(challenger=opponent, opponent=challenger),
        finished_at__gte=cutoff,
    ).exists()


def _user_points(user: User) -> int:
    profile = getattr(user, "profile", None)
    return int(getattr(profile, "points", 0) or 0)


def create_duel(challenger: User, opponent_id: int, duration_hours: int) -> Duel:
    if challenger.id == opponent_id:
        raise DuelError("You cannot duel yourself.", code="self_duel")

    if duration_hours not in ALLOWED_DURATIONS:
        raise DuelError("Invalid duration.", code="invalid_duration")

    try:
        opponent = User.objects.select_related("profile").get(id=opponent_id)
    except User.DoesNotExist as exc:
        raise DuelError("Opponent not found.", code="opponent_not_found") from exc

    if _active_or_pending_count(challenger) >= MAX_ACTIVE_DUELS_PER_USER:
        raise DuelError("You already have too many active duels.", code="max_active")

    if _recent_pair_cooldown(challenger, opponent):
        raise DuelError(
            "Wait a moment before challenging this player again.",
            code="pair_cooldown",
        )

    existing_open = Duel.objects.filter(
        challenger=challenger,
        opponent=opponent,
        status__in=[Duel.STATUS_PENDING, Duel.STATUS_ACTIVE],
    ).exists()
    if existing_open:
        raise DuelError(
            "There is already an open challenge with this player.",
            code="duplicate",
        )

    return Duel.objects.create(
        challenger=challenger,
        opponent=opponent,
        duration_hours=duration_hours,
        bonus_xp=DURATION_BONUS_XP[duration_hours],
        status=Duel.STATUS_PENDING,
    )


def respond_to_duel(user: User, duel: Duel, action: str) -> Duel:
    if duel.opponent_id != user.id:
        raise DuelError("Only the opponent can respond.", code="forbidden")
    if duel.status != Duel.STATUS_PENDING:
        raise DuelError("Duel is no longer pending.", code="not_pending")

    if action == "accept":
        with transaction.atomic():
            duel.status = Duel.STATUS_ACTIVE
            duel.accepted_at = timezone.now()
            duel.ends_at = duel.accepted_at + timedelta(hours=duel.duration_hours)
            duel.challenger_xp_start = _user_points(duel.challenger)
            duel.opponent_xp_start = _user_points(duel.opponent)
            duel.save(
                update_fields=[
                    "status",
                    "accepted_at",
                    "ends_at",
                    "challenger_xp_start",
                    "opponent_xp_start",
                ]
            )
        return duel

    if action == "decline":
        duel.status = Duel.STATUS_DECLINED
        duel.finished_at = timezone.now()
        duel.save(update_fields=["status", "finished_at"])
        return duel

    raise DuelError("Invalid action.", code="invalid_action")


def cancel_duel(user: User, duel: Duel) -> Duel:
    if duel.challenger_id != user.id:
        raise DuelError("Only the challenger can cancel.", code="forbidden")
    if duel.status != Duel.STATUS_PENDING:
        raise DuelError("Only pending duels can be cancelled.", code="not_pending")
    duel.status = Duel.STATUS_CANCELLED
    duel.finished_at = timezone.now()
    duel.save(update_fields=["status", "finished_at"])
    return duel


def snapshot_duel(duel: Duel) -> DuelSnapshot:
    return DuelSnapshot(
        duel=duel,
        challenger_xp_current=_user_points(duel.challenger),
        opponent_xp_current=_user_points(duel.opponent),
    )


def finalize_duel(duel: Duel) -> Duel:
    """Score and award the duel. Idempotent — safe to call repeatedly."""

    if duel.is_final:
        return duel
    if duel.status != Duel.STATUS_ACTIVE:
        # Pending → never accepted by deadline → expire
        if duel.status == Duel.STATUS_PENDING:
            duel.status = Duel.STATUS_EXPIRED
            duel.finished_at = timezone.now()
            duel.save(update_fields=["status", "finished_at"])
        return duel

    with transaction.atomic():
        snap = snapshot_duel(duel)
        duel.challenger_xp_end = snap.challenger_xp_current
        duel.opponent_xp_end = snap.opponent_xp_current

        c_delta = snap.challenger_delta
        o_delta = snap.opponent_delta

        if c_delta > o_delta:
            duel.status = Duel.STATUS_WON_CHALLENGER
            duel.winner = duel.challenger
        elif o_delta > c_delta:
            duel.status = Duel.STATUS_WON_OPPONENT
            duel.winner = duel.opponent
        else:
            duel.status = Duel.STATUS_DRAW
            duel.winner = None

        duel.finished_at = timezone.now()
        duel.save(
            update_fields=[
                "challenger_xp_end",
                "opponent_xp_end",
                "status",
                "winner",
                "finished_at",
            ]
        )

        if duel.winner is not None and duel.bonus_xp > 0:
            grant_reward(
                duel.winner,
                event_key=f"duel_win:{duel.id}",
                points=duel.bonus_xp,
            )

    return duel


def serialize_duel(duel: Duel, viewer: User) -> dict:
    snap = snapshot_duel(duel) if duel.status == Duel.STATUS_ACTIVE else None
    challenger_dict = user_display_dict(duel.challenger, include_id=True)
    opponent_dict = user_display_dict(duel.opponent, include_id=True)

    if duel.status == Duel.STATUS_ACTIVE and snap is not None:
        c_delta = snap.challenger_delta
        o_delta = snap.opponent_delta
    elif duel.challenger_xp_end is not None and duel.opponent_xp_end is not None:
        c_delta = max(0, duel.challenger_xp_end - duel.challenger_xp_start)
        o_delta = max(0, duel.opponent_xp_end - duel.opponent_xp_start)
    else:
        c_delta = 0
        o_delta = 0

    viewer_role = (
        "challenger"
        if duel.challenger_id == viewer.id
        else "opponent" if duel.opponent_id == viewer.id else "observer"
    )

    return {
        "id": duel.id,
        "status": duel.status,
        "duration_hours": duel.duration_hours,
        "bonus_xp": duel.bonus_xp,
        "created_at": duel.created_at.isoformat() if duel.created_at else None,
        "accepted_at": duel.accepted_at.isoformat() if duel.accepted_at else None,
        "ends_at": duel.ends_at.isoformat() if duel.ends_at else None,
        "finished_at": duel.finished_at.isoformat() if duel.finished_at else None,
        "challenger": {
            **challenger_dict,
            "profile_avatar": getattr(
                getattr(duel.challenger, "profile", None), "profile_avatar", None
            ),
            "xp_delta": c_delta,
        },
        "opponent": {
            **opponent_dict,
            "profile_avatar": getattr(
                getattr(duel.opponent, "profile", None), "profile_avatar", None
            ),
            "xp_delta": o_delta,
        },
        "winner_id": duel.winner_id,
        "viewer_role": viewer_role,
    }
