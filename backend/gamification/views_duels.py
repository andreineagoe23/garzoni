"""REST endpoints for persistent XP-race duels."""

from __future__ import annotations

from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from gamification.models import Duel
from gamification.services.duels import (
    DuelError,
    cancel_duel,
    create_duel,
    finalize_duel,
    respond_to_duel,
    serialize_duel,
)


def _user_visible_duel(viewer, duel_id: int) -> Duel:
    return get_object_or_404(
        Duel.objects.select_related("challenger__profile", "opponent__profile", "winner").filter(
            models.Q(challenger=viewer) | models.Q(opponent=viewer)
        ),
        id=duel_id,
    )


class DuelListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        qs = (
            Duel.objects.select_related("challenger__profile", "opponent__profile", "winner")
            .filter(
                models.Q(challenger=request.user) | models.Q(opponent=request.user),
                status__in=[Duel.STATUS_PENDING, Duel.STATUS_ACTIVE],
            )
            .order_by("-created_at")
        )
        data = [serialize_duel(d, request.user) for d in qs]
        return Response(data)

    def post(self, request):
        opponent_id = request.data.get("opponent_id")
        duration_hours = request.data.get("duration_hours")
        try:
            opponent_id = int(opponent_id)
            duration_hours = int(duration_hours)
        except (TypeError, ValueError):
            return Response(
                {"error": "opponent_id and duration_hours are required integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            duel = create_duel(request.user, opponent_id, duration_hours)
        except DuelError as exc:
            return Response(
                {"error": str(exc), "code": exc.code},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            serialize_duel(duel, request.user),
            status=status.HTTP_201_CREATED,
        )


class DuelHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request):
        qs = (
            Duel.objects.select_related("challenger__profile", "opponent__profile", "winner")
            .filter(
                models.Q(challenger=request.user) | models.Q(opponent=request.user),
                status__in=list(Duel.FINAL_STATUSES),
            )
            .order_by("-finished_at")[:50]
        )
        data = [serialize_duel(d, request.user) for d in qs]
        return Response(data)


class DuelDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get(self, request, duel_id: int):
        duel = _user_visible_duel(request.user, duel_id)
        return Response(serialize_duel(duel, request.user))


class DuelRespondView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def post(self, request, duel_id: int):
        duel = _user_visible_duel(request.user, duel_id)
        action = (request.data.get("action") or "").strip().lower()
        if action not in {"accept", "decline"}:
            return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            duel = respond_to_duel(request.user, duel, action)
        except DuelError as exc:
            return Response(
                {"error": str(exc), "code": exc.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(serialize_duel(duel, request.user))


class DuelCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def post(self, request, duel_id: int):
        duel = _user_visible_duel(request.user, duel_id)
        try:
            duel = cancel_duel(request.user, duel)
        except DuelError as exc:
            return Response(
                {"error": str(exc), "code": exc.code},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(serialize_duel(duel, request.user))


class DuelFinalizeView(APIView):
    """Manual finalize trigger (used by clients after ends_at passes; idempotent)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def post(self, request, duel_id: int):
        duel = _user_visible_duel(request.user, duel_id)
        if duel.ends_at and duel.ends_at > timezone.now():
            return Response(
                {"error": "Duel is still in progress.", "code": "still_active"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        duel = finalize_duel(duel)
        return Response(serialize_duel(duel, request.user))
