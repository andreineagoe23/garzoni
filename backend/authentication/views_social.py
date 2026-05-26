"""Social discovery endpoints: friend activity feed, suggestions, user search."""

from __future__ import annotations

from collections import defaultdict

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from authentication.models import FriendRequest, UserProfile
from authentication.user_display import user_display_dict
from gamification.models import Duel, MissionCompletion, UserBadge
from gamification.services.duels import serialize_duel


def _friend_ids_for(user) -> list[int]:
    rows = FriendRequest.objects.filter(
        models.Q(sender=user) | models.Q(receiver=user),
        status="accepted",
    ).values_list("sender_id", "receiver_id")
    ids = set()
    for s, r in rows:
        ids.add(s)
        ids.add(r)
    ids.discard(user.id)
    return list(ids)


def _user_brief(user: User) -> dict:
    profile = getattr(user, "profile", None)
    return {
        **user_display_dict(user, include_id=True),
        "profile_avatar": getattr(profile, "profile_avatar", None),
    }


class FriendActivityFeedView(APIView):
    """Aggregated recent events from a user's accepted friends."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        friend_ids = _friend_ids_for(request.user)
        if not friend_ids:
            return Response([])

        cutoff = timezone.now() - timezone.timedelta(days=14)
        users_by_id = {
            u.id: u for u in User.objects.filter(id__in=friend_ids).select_related("profile")
        }

        events: list[dict] = []

        for mc in (
            MissionCompletion.objects.filter(
                user_id__in=friend_ids,
                status="completed",
                completed_at__gte=cutoff,
            )
            .select_related("mission")
            .order_by("-completed_at")[:30]
        ):
            user = users_by_id.get(mc.user_id)
            if not user:
                continue
            events.append(
                {
                    "type": "mission_completed",
                    "at": mc.completed_at.isoformat() if mc.completed_at else None,
                    "user": _user_brief(user),
                    "mission_name": getattr(mc.mission, "name", None),
                }
            )

        for ub in (
            UserBadge.objects.filter(user_id__in=friend_ids, earned_at__gte=cutoff)
            .select_related("badge")
            .order_by("-earned_at")[:30]
        ):
            user = users_by_id.get(ub.user_id)
            if not user:
                continue
            events.append(
                {
                    "type": "badge_earned",
                    "at": ub.earned_at.isoformat() if ub.earned_at else None,
                    "user": _user_brief(user),
                    "badge_name": ub.badge.name,
                    "badge_level": ub.badge.badge_level,
                }
            )

        for duel in (
            Duel.objects.filter(
                winner_id__in=friend_ids,
                status__in=[Duel.STATUS_WON_CHALLENGER, Duel.STATUS_WON_OPPONENT],
                finished_at__gte=cutoff,
            )
            .select_related("winner__profile")
            .order_by("-finished_at")[:20]
        ):
            user = duel.winner
            if not user:
                continue
            events.append(
                {
                    "type": "duel_won",
                    "at": duel.finished_at.isoformat() if duel.finished_at else None,
                    "user": _user_brief(user),
                    "bonus_xp": duel.bonus_xp,
                }
            )

        events.sort(key=lambda e: e["at"] or "", reverse=True)
        return Response(events[:50])


class FriendSuggestionsView(APIView):
    """Suggest users to add: mutuals first, then similar XP, then top global ranked."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        viewer = request.user
        friend_ids = set(_friend_ids_for(viewer))
        exclude_ids = friend_ids | {viewer.id}

        outgoing_pending = set(
            FriendRequest.objects.filter(sender=viewer, status="pending").values_list(
                "receiver_id", flat=True
            )
        )
        incoming_pending = set(
            FriendRequest.objects.filter(receiver=viewer, status="pending").values_list(
                "sender_id", flat=True
            )
        )
        exclude_ids |= outgoing_pending | incoming_pending

        # Mutuals: friends of my friends
        mutual_counts: dict[int, int] = defaultdict(int)
        if friend_ids:
            rows = FriendRequest.objects.filter(
                models.Q(sender_id__in=friend_ids) | models.Q(receiver_id__in=friend_ids),
                status="accepted",
            ).values_list("sender_id", "receiver_id")
            for s, r in rows:
                for uid in (s, r):
                    if uid in exclude_ids or uid in friend_ids:
                        continue
                    mutual_counts[uid] += 1

        ranked_mutuals = sorted(mutual_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]

        suggestions: list[dict] = []
        seen: set[int] = set()
        for uid, count in ranked_mutuals:
            try:
                user = User.objects.select_related("profile").get(id=uid)
            except User.DoesNotExist:
                continue
            suggestions.append(
                {
                    **_user_brief(user),
                    "reason": "mutual",
                    "mutual_count": count,
                    "points": int(getattr(getattr(user, "profile", None), "points", 0) or 0),
                }
            )
            seen.add(uid)

        # Fill remaining slots with top global users
        if len(suggestions) < 10:
            top = (
                UserProfile.objects.exclude(user_id__in=exclude_ids | seen)
                .select_related("user")
                .order_by("-points")[: 10 - len(suggestions)]
            )
            for p in top:
                suggestions.append(
                    {
                        **_user_brief(p.user),
                        "reason": "top",
                        "mutual_count": 0,
                        "points": int(p.points or 0),
                    }
                )

        return Response(suggestions)


class UserSearchView(APIView):
    """Server-side username search."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response([])

        qs = (
            User.objects.filter(username__icontains=q)
            .exclude(id=request.user.id)
            .select_related("profile")
            .order_by("-profile__points")[:25]
        )
        results = [
            {
                **_user_brief(u),
                "points": int(getattr(getattr(u, "profile", None), "points", 0) or 0),
            }
            for u in qs
        ]
        return Response(results)
