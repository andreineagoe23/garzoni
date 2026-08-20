"""
Weekly Leagues — Duolingo-style cohorts of ~LEAGUE_COHORT_SIZE users within a
skill tier (bronze/silver/gold/diamond), ranked by XP earned in the current
week and promoted/demoted at week close.

Week boundaries reuse gamification.services.mission_cycles.weekly_cycle_id()
("YYYY-Www") so a league's notion of "week" agrees with weekly missions and
the windowed-XP leaderboard — there is exactly one week-key scheme in this
codebase; do not invent another.

Everything here is inert when settings.LEAGUES_ENABLED is False: assignment
creates nothing, record_league_xp is a no-op, close_week closes nothing, and
the API returns a "disabled" payload instead of 404/500.

Tiebreak rule (standings + close_week ranking): order by weekly_xp desc,
then joined_at asc, then user_id asc. Earlier-joined members rank above
later joiners on an XP tie — same "reward showing up first" spirit as the
windowed leaderboard's `.order_by("-xp", "user")` tiebreak — and user_id is
the final tiebreak so ordering is 100% deterministic even for two users who
joined in the same request.

Cold-start guard: this app currently has low DAU. A tier that historically
attracts very few users would otherwise ship a lonely 2-3 person "league",
which reads as broken rather than exclusive. LEAGUE_MIN_COHORT_SIZE (5) is
the floor: before opening a *new* league for a tier, we check how many
distinct users populated that tier last cycle; if that count is below the
floor, new assignments for the tier are redirected into an adjacent tier's
league for this cycle instead (bronze merges up into silver, since nothing
sits below bronze; silver/gold/diamond merge down into the next tier below).
On the very first cycle ever (no history to check), no merge happens — we
have no evidence a tier is too small yet.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F

from gamification.models import League, LeagueMember
from gamification.services.mission_cycles import local_cycle_date, weekly_cycle_id

logger = logging.getLogger(__name__)

# --- Cold-start guard ---
# Floor below which a league cohort doesn't feel like a real cohort. This is
# NOT the promotion/demotion threshold (see MIN_COHORT_FOR_PROMOTION below) —
# it governs whether a *new* league gets created at all for a small tier.
LEAGUE_MIN_COHORT_SIZE = 5
DEFAULT_LEAGUE_COHORT_SIZE = 30

# --- Week-close promotion rules ---
MIN_COHORT_FOR_PROMOTION = 10  # below this, everyone is `held` (no promote/demote)
PROMOTE_COUNT = 5
DEMOTE_COUNT = 5

# Payout for finishing a league week, by outcome. Kept modest relative to
# STREAK_MILESTONE_REWARDS in services/rewards.py — this is a weekly cadence,
# not a rare milestone. Demoted still gets a zero-value ledger row (via
# record_zero_ledger) purely so "did this user's league finish already get
# processed" has one place to check (the ledger), matching the
# streak_wager_open: zero-grant convention in services/wagers.py.
LEAGUE_FINISH_REWARDS: dict[str, tuple[int, Decimal]] = {
    LeagueMember.OUTCOME_PROMOTED: (50, Decimal("5.00")),
    LeagueMember.OUTCOME_HELD: (20, Decimal("2.00")),
    LeagueMember.OUTCOME_DEMOTED: (0, Decimal("0.00")),
}


def _tier_index(tier: str) -> int:
    return League.TIER_ORDER.index(tier)


def _merge_target_tier(tier: str) -> str:
    """Adjacent tier a too-small tier's new assignments should fall back to."""
    idx = _tier_index(tier)
    if idx == 0:
        return League.TIER_ORDER[1]  # bronze -> silver (nothing below bronze)
    return League.TIER_ORDER[idx - 1]  # silver/gold/diamond -> one tier down


def _tier_after_outcome(tier: str, outcome: Optional[str]) -> str:
    idx = _tier_index(tier)
    if outcome == LeagueMember.OUTCOME_PROMOTED:
        idx = min(idx + 1, len(League.TIER_ORDER) - 1)
    elif outcome == LeagueMember.OUTCOME_DEMOTED:
        idx = max(idx - 1, 0)
    return League.TIER_ORDER[idx]


def _previous_cycle_id(cycle_id: str) -> Optional[str]:
    """Best-effort previous week's cycle_id for the cold-start population
    check. Computed from today's date rather than parsed out of `cycle_id`
    (ISO week arithmetic on a "YYYY-Www" string is fiddlier and buys nothing
    here, since assign_to_league always calls this with the *current* cycle)."""
    today = local_cycle_date()
    prev = weekly_cycle_id(today - timedelta(days=7))
    return prev if prev != cycle_id else None


def _tier_population_too_small(tier: str, cycle_id: str) -> bool:
    prev_cycle_id = _previous_cycle_id(cycle_id)
    if not prev_cycle_id:
        return False  # no history yet — don't guess
    if not League.objects.filter(tier=tier, cycle_id=prev_cycle_id).exists():
        # The tier didn't even exist last cycle (e.g. the very first cycle
        # ever, or a brand new tier). Zero rows here is "no evidence", not
        # "evidence of a too-small tier" — those are different things, and
        # conflating them would merge every tier away on a fresh database.
        return False
    population = (
        LeagueMember.objects.filter(league__tier=tier, cycle_id=prev_cycle_id)
        .values("user_id")
        .distinct()
        .count()
    )
    return population < LEAGUE_MIN_COHORT_SIZE


def _get_or_create_open_league(tier: str, cycle_id: str) -> League:
    """League to place the next assignment into: the lowest-index league of
    the (possibly cold-start-merged) tier with room, or a freshly created one."""
    cohort_size = int(getattr(settings, "LEAGUE_COHORT_SIZE", DEFAULT_LEAGUE_COHORT_SIZE) or 0)
    if cohort_size <= 0:
        cohort_size = DEFAULT_LEAGUE_COHORT_SIZE

    effective_tier = tier
    if _tier_population_too_small(tier, cycle_id):
        effective_tier = _merge_target_tier(tier)

    with transaction.atomic():
        candidates = list(
            League.objects.select_for_update()
            .filter(tier=effective_tier, cycle_id=cycle_id)
            .order_by("index")
        )
        for league in candidates:
            if league.members.count() < cohort_size:
                return league

        next_index = len(candidates)
        try:
            with transaction.atomic():
                return League.objects.create(
                    tier=effective_tier, cycle_id=cycle_id, index=next_index
                )
        except IntegrityError:
            # Race backstop: another worker created this (tier, cycle, index)
            # between our select_for_update snapshot and the insert.
            return League.objects.get(tier=effective_tier, cycle_id=cycle_id, index=next_index)


def _resolve_starting_tier(user) -> str:
    """New users start in bronze; returning users resume in the tier their
    last resolved (closed) membership left them in after promotion/demotion."""
    last = (
        LeagueMember.objects.filter(user=user, outcome__isnull=False)
        .select_related("league")
        .order_by("-league__cycle_id", "-id")
        .first()
    )
    if last is None:
        return League.TIER_BRONZE
    return _tier_after_outcome(last.league.tier, last.outcome)


def assign_to_league(user) -> Optional[LeagueMember]:
    """
    Lazily assign `user` into a league for the CURRENT cycle, if they don't
    already have one. Mirrors MISSIONS_LAZY_ASSIGNMENT: nothing is created
    until a user actually earns XP this week, so inactive users never pad a
    cohort. Returns the (possibly pre-existing) membership, or None if
    leagues are disabled.

    Safe to call repeatedly — the (user, cycle_id) unique constraint means a
    concurrent double-call resolves to the same row rather than an error.
    """
    if not getattr(settings, "LEAGUES_ENABLED", False):
        return None

    cycle_id = weekly_cycle_id()
    existing = (
        LeagueMember.objects.select_related("league").filter(user=user, cycle_id=cycle_id).first()
    )
    if existing is not None:
        return existing

    tier = _resolve_starting_tier(user)
    league = _get_or_create_open_league(tier, cycle_id)
    try:
        return LeagueMember.objects.create(league=league, user=user, cycle_id=cycle_id)
    except IntegrityError:
        # Race backstop for the (user, cycle_id) unique constraint.
        return (
            LeagueMember.objects.select_related("league")
            .filter(user=user, cycle_id=cycle_id)
            .first()
        )


def record_league_xp(user, points: int) -> None:
    """
    Single hook called from gamification.services.rewards.grant_reward right
    after the ledger row commits. Bumps the user's current-cycle league
    membership's weekly_xp by `points` via an F() update (no read-then-write
    race), lazily assigning the user into a league first if they don't have
    one yet this cycle.

    Because RewardLedgerEntry is unique on (user, event_key), a duplicate
    grant_reward call for the same event_key raises IntegrityError and
    returns *before* this hook is ever reached — so this function never sees
    (and never has to guard against) a duplicate grant.

    No-op (and never raises) when LEAGUES_ENABLED is false, when `points` is
    not positive, or when assignment could not produce a membership. Errors
    are swallowed and logged — a leagues bug must never break a reward grant,
    same posture as _schedule_badge_evaluation in services/rewards.py.
    """
    if not points or points <= 0:
        return
    if not getattr(settings, "LEAGUES_ENABLED", False):
        return

    try:
        membership = assign_to_league(user)
        if membership is None:
            return
        updated = LeagueMember.objects.filter(pk=membership.pk).update(
            weekly_xp=F("weekly_xp") + int(points)
        )
        if not updated:
            logger.warning(
                "record_league_xp: membership vanished mid-update",
                extra={"user_id": getattr(user, "id", None), "league_member_id": membership.pk},
            )
    except Exception:
        logger.exception(
            "record_league_xp failed; league XP not recorded (reward grant itself is unaffected)",
            extra={"user_id": getattr(user, "id", None)},
        )


def _rank_members(members: list[LeagueMember]) -> list[LeagueMember]:
    """Apply the documented tiebreak: weekly_xp desc, joined_at asc, user_id asc."""
    return sorted(members, key=lambda m: (-m.weekly_xp, m.joined_at, m.user_id))


def _close_one_league(league: League) -> list[dict]:
    """Rank, set final_rank/outcome, and pay out for one league. Returns one
    settled row per member, so the caller can announce the result *after* the
    transaction commits — an HTTP call to Customer.io inside `atomic()` would
    hold the row locks open for the length of a network round trip. Idempotent:
    weekly_xp is not mutated here, so re-running recomputes the identical
    ranking/outcome, and grant_reward's ledger uniqueness on event_key makes the
    payout itself a no-op the second time."""
    with transaction.atomic():
        members = list(
            LeagueMember.objects.select_for_update().select_related("user").filter(league=league)
        )
        if not members:
            return []

        settled: list[dict] = []
        ranked = _rank_members(members)
        total = len(ranked)
        promote_n = demote_n = 0
        if total >= MIN_COHORT_FOR_PROMOTION:
            promote_n = min(PROMOTE_COUNT, total)
            demote_n = min(DEMOTE_COUNT, total - promote_n)

        for rank, member in enumerate(ranked, start=1):
            if rank <= promote_n:
                outcome = LeagueMember.OUTCOME_PROMOTED
            elif rank > total - demote_n:
                outcome = LeagueMember.OUTCOME_DEMOTED
            else:
                outcome = LeagueMember.OUTCOME_HELD

            member.final_rank = rank
            member.outcome = outcome
            member.save(update_fields=["final_rank", "outcome"])

            reward_points, reward_coins = LEAGUE_FINISH_REWARDS[outcome]
            from gamification.services.rewards import grant_reward

            try:
                grant_reward(
                    member.user,
                    f"league_finish:{league.id}:{member.user_id}",
                    points=reward_points,
                    coins=reward_coins,
                    bump_streak="none",
                    evaluate_badges=True,
                    record_zero_ledger=True,
                )
            except Exception:
                logger.exception(
                    "close_week: grant_reward failed for league finish",
                    extra={"league_id": league.id, "user_id": member.user_id},
                )

            settled.append(
                {
                    "user": member.user,
                    "rank": rank,
                    "outcome": outcome,
                    "tier": league.tier,
                    "cohort_size": total,
                    "weekly_xp": int(member.weekly_xp or 0),
                }
            )

        return settled


def _announce_league_results(settled: list[dict], cycle_id: str) -> int:
    """Emit `league_week_closed` per member so a Customer.io journey can tell
    people how their week went.

    Leagues have been closing every Sunday at 23:55 and nobody was ever told —
    the whole competitive loop settled in silence. Runs after the settlement
    transaction has committed, and never raises: a messaging failure must not
    make a settled league look unsettled.
    """
    from django.conf import settings as dj_settings

    if not settled or not getattr(dj_settings, "CIO_JOURNEY_EVENTS_ENABLED", False):
        return 0
    try:
        from notifications.enums import CioEventName
        from notifications.events import NotificationEvents
    except Exception:
        logger.exception("close_week: notifications import failed")
        return 0

    publisher = NotificationEvents()
    sent = 0
    for row in settled:
        try:
            ok, _ = publisher.track(
                row["user"],
                CioEventName.LEAGUE_WEEK_CLOSED,
                {
                    "cycle_id": cycle_id,
                    "tier": row["tier"],
                    "rank": row["rank"],
                    "outcome": row["outcome"],
                    "cohort_size": row["cohort_size"],
                    "weekly_xp": row["weekly_xp"],
                },
                identify_first=True,
            )
            if ok:
                sent += 1
        except Exception:
            logger.exception(
                "close_week: league_week_closed publish failed",
                extra={"user_id": getattr(row.get("user"), "id", None)},
            )
    return sent


def close_week(cycle_id: Optional[str] = None) -> dict:
    """
    Celery-invoked weekly settlement. For each league of `cycle_id` (default:
    the current cycle — Beat fires this just before the cycle rolls over),
    ranks members, sets final_rank/outcome, and pays out via grant_reward.
    Safe to call twice. No-op when LEAGUES_ENABLED is false.
    """
    if not getattr(settings, "LEAGUES_ENABLED", False):
        return {"enabled": False, "leagues_closed": 0, "members_processed": 0}

    cid = cycle_id or weekly_cycle_id()

    leagues_closed = 0
    members_processed = 0
    for league in League.objects.filter(cycle_id=cid).iterator(chunk_size=100):
        try:
            settled = _close_one_league(league)
            members_processed += len(settled)
            leagues_closed += 1
        except Exception:
            logger.exception("close_week: failed to close league %s", league.id)
            continue
        _announce_league_results(settled, cid)

    return {
        "enabled": True,
        "cycle_id": cid,
        "leagues_closed": leagues_closed,
        "members_processed": members_processed,
    }


@dataclass
class StandingsRow:
    user_id: int
    username: str
    weekly_xp: int
    rank: int
    is_self: bool = False


@dataclass
class Standings:
    enabled: bool
    assigned: bool = False
    tier: Optional[str] = None
    cycle_id: Optional[str] = None
    league_id: Optional[int] = None
    own_rank: Optional[int] = None
    members: list[StandingsRow] = field(default_factory=list)


def current_standings(user) -> Standings:
    """The user's current-cycle cohort, ordered standings, and own rank."""
    if not getattr(settings, "LEAGUES_ENABLED", False):
        return Standings(enabled=False)

    cycle_id = weekly_cycle_id()
    membership = (
        LeagueMember.objects.select_related("league").filter(user=user, cycle_id=cycle_id).first()
    )
    if membership is None:
        return Standings(enabled=True, assigned=False, cycle_id=cycle_id)

    members = list(LeagueMember.objects.select_related("user").filter(league=membership.league))
    ranked = _rank_members(members)

    rows: list[StandingsRow] = []
    own_rank = None
    for rank, m in enumerate(ranked, start=1):
        is_self = m.user_id == user.id
        if is_self:
            own_rank = rank
        rows.append(
            StandingsRow(
                user_id=m.user_id,
                username=m.user.username,
                weekly_xp=m.weekly_xp,
                rank=rank,
                is_self=is_self,
            )
        )

    return Standings(
        enabled=True,
        assigned=True,
        tier=membership.league.tier,
        cycle_id=membership.league.cycle_id,
        league_id=membership.league_id,
        own_rank=own_rank,
        members=rows,
    )


def league_history(user, limit: int = 20) -> list[dict]:
    """Past (resolved) memberships for `user`, most recent cycle first.
    Empty (not an error) when leagues are disabled."""
    if not getattr(settings, "LEAGUES_ENABLED", False):
        return []
    rows = (
        LeagueMember.objects.select_related("league")
        .filter(user=user, final_rank__isnull=False)
        .order_by("-league__cycle_id", "-id")[:limit]
    )
    return [
        {
            "league_id": r.league_id,
            "tier": r.league.tier,
            "cycle_id": r.league.cycle_id,
            "weekly_xp": r.weekly_xp,
            "final_rank": r.final_rank,
            "outcome": r.outcome,
        }
        for r in rows
    ]
