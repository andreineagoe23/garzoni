"""
HTTP API for budgeting and Personal CFO.

All endpoints are gated by Plus/Pro via the central entitlement helpers.
Provider linking endpoints additionally require the configured provider to be
ready; otherwise they respond with a clean ``provider_unavailable`` error so the
client can fall back to manual entry or CSV import.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import check_and_consume_entitlement, get_user_plan, plan_allows
from budgeting.models import (
    BudgetEnvelope,
    LinkedAccount,
    ProviderWebhookEvent,
    SpendingAnomaly,
    Transaction,
)
from budgeting.serializers import (
    BudgetEnvelopeCreateSerializer,
    BudgetEnvelopeSerializer,
    LinkedAccountSerializer,
    SpendingAnomalySerializer,
    TransactionSerializer,
)
from django.core.cache import cache

from support.services.openai import OpenAIService, get_conversation_history, reset_cfo_conversation
from budgeting.services.dashboard import (
    CFO_DASHBOARD_CACHE_TTL,
    build_dashboard,
    build_dashboard_context,
    dashboard_cache_key,
    resolve_narrative,
)
from budgeting.services.providers import get_provider
from budgeting.services.summaries import (
    available_periods,
    envelopes_with_progress,
    get_or_compute_summary,
    resolve_active_period,
)
from finance.models import FinancialGoal, PortfolioEntry
from finance.utils import record_funnel_event
from core.request_platform import resolve_request_platform

logger = logging.getLogger(__name__)


def parse_period_param(value):
    """Parse a ``?period=YYYY-MM`` (or ``YYYY-MM-DD``) filter into a month."""
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date().replace(day=1)
        except ValueError:
            continue
    return None


def _require_budget_entitlement(request):
    plan = get_user_plan(request.user)
    if not plan_allows(plan, "plus"):
        return Response(
            {
                "error": "Requires Plus or Pro plan.",
                "reason": "upgrade",
                "feature": "budget_tracking",
            },
            status=402,
        )
    return None


class LinkedAccountViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LinkedAccountSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().retrieve(request, *args, **kwargs)

    def get_queryset(self):
        return LinkedAccount.objects.filter(user=self.request.user)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = Transaction.objects.filter(user=self.request.user)
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if start:
            qs = qs.filter(posted_at__gte=start)
        if end:
            qs = qs.filter(posted_at__lte=end)
        return qs.order_by("-posted_at")[:500]


class BudgetEnvelopeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return BudgetEnvelopeCreateSerializer
        return BudgetEnvelopeSerializer

    def list(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        requested = parse_period_param(request.query_params.get("period"))
        ref = requested or resolve_active_period(request.user)
        envelopes = envelopes_with_progress(request.user, ref=ref)
        return Response({"results": envelopes, "period": ref.isoformat()})

    def retrieve(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        response = super().create(request, *args, **kwargs)
        record_funnel_event(
            "budget_envelope_created",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={
                "category": (response.data or {}).get("category"),
            },
        )
        return response

    def update(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        return BudgetEnvelope.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SpendingSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        # An imported statement is usually *last* month's, so defaulting to the
        # current month showed an empty dashboard right after a successful
        # import. Honour an explicit ?period=, else fall back to the latest
        # month that actually has data.
        requested = parse_period_param(request.query_params.get("period"))
        ref = requested or resolve_active_period(request.user)
        summary = get_or_compute_summary(request.user, ref=ref)
        periods = available_periods(request.user)
        return Response(
            {
                "period": summary.period_start.isoformat(),
                "available_periods": [p.isoformat() for p in periods],
                "is_current_month": summary.period_start == timezone.now().date().replace(day=1),
                "currency": summary.currency,
                "total_income": float(summary.total_income),
                "total_spent": float(summary.total_spent),
                "net_cash_flow": float(summary.net_cash_flow),
                "by_category": [
                    {
                        "category": row.category,
                        "label": row.label,
                        "spent": float(row.spent),
                        "target": float(row.target) if row.target is not None else None,
                        "over_budget": row.over_budget,
                    }
                    for row in summary.by_category
                ],
            }
        )


class SpendingAnomalyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        qs = SpendingAnomaly.objects.filter(user=request.user, resolved_at__isnull=True).order_by(
            "-detected_for"
        )[:50]
        return Response({"results": SpendingAnomalySerializer(qs, many=True).data})


class ProviderStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        provider = get_provider()
        status_dto = provider.status()
        return Response(
            {
                "enabled": status_dto.enabled,
                "provider": status_dto.provider,
                "region": status_dto.region,
                "ready": status_dto.ready,
            }
        )


class ProviderLinkTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gate = _require_budget_entitlement(request)
        if gate:
            return gate
        provider = get_provider()
        if not provider.status().enabled:
            return Response(
                {"error": "provider_unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            url = provider.create_link_url(request.user)
        except (RuntimeError, NotImplementedError) as exc:
            logger.warning("Budgeting link unavailable: %s", exc)
            return Response(
                {"error": "provider_unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        record_funnel_event(
            "budget_account_link_started",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={"provider": provider.name},
        )
        return Response({"connect_url": url, "provider": provider.name})


class ProviderWebhookView(APIView):
    """Provider-side webhook endpoint with signature verification + idempotency."""

    permission_classes: list = []  # public; auth via signature header
    authentication_classes: list = []

    def post(self, request):
        provider = get_provider()
        sig = request.headers.get("X-Garzoni-Provider-Signature", "")
        if not provider.verify_webhook_signature(request.body, sig):
            return Response({"error": "invalid_signature"}, status=400)
        event_id = request.data.get("event_id") or hashlib.sha256(request.body).hexdigest()
        with transaction.atomic():
            event, created = ProviderWebhookEvent.objects.select_for_update().get_or_create(
                event_id=event_id,
                defaults={"provider": provider.name, "payload": request.data or {}},
            )
            if not created and event.processed:
                return Response({"ok": True, "duplicate": True})
            # Real implementation would dispatch by event type. We mark accepted now
            # and rely on Celery/cron tasks to enrich.
            event.processed = True
            event.processed_at = timezone.now()
            event.save(update_fields=["processed", "processed_at"])
        return Response({"ok": True})


class PersonalCfoSummaryView(APIView):
    """High-level Personal CFO summary used by web + mobile hubs."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = get_user_plan(request.user)
        if not plan_allows(plan, "plus"):
            return Response(
                {
                    "error": "Requires Plus or Pro plan.",
                    "reason": "upgrade",
                    "feature": "personal_cfo",
                },
                status=402,
            )
        today = resolve_active_period(request.user)
        spending = None
        try:
            spending = get_or_compute_summary(request.user, ref=today)
        except Exception as exc:
            logger.warning("CFO summary aggregation failed: %s", exc)

        highlights = []
        alerts = []
        next_action = None

        if spending is not None:
            if spending.total_income > 0 and spending.net_cash_flow > 0:
                highlights.append(
                    f"You're saving {spending.net_cash_flow:.0f} {spending.currency} this month."
                )
            elif spending.total_spent > 0:
                highlights.append(
                    f"This month you've spent {spending.total_spent:.0f} {spending.currency} so far."
                )
            over = [r for r in spending.by_category if r.over_budget]
            for row in over[:3]:
                alerts.append(
                    f"{row.label}: {row.spent:.0f} of {row.target:.0f} {spending.currency}."
                )
            if over:
                next_action = {
                    "label": "Open Budget Planner",
                    "href": "/tools/budget-planner",
                }
            else:
                next_action = {
                    "label": "See your next steps",
                    "href": "/tools/next-steps",
                }
        else:
            next_action = {
                "label": "Start with goals",
                "href": "/tools/reality-check",
            }

        # Active anomalies (unresolved) add to alerts.
        anomalies = SpendingAnomaly.objects.filter(
            user=request.user, resolved_at__isnull=True
        ).order_by("-detected_for")[:3]
        for a in anomalies:
            if a.summary and a.summary not in alerts:
                alerts.append(a.summary)

        record_funnel_event(
            "personal_cfo_summary_view",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={
                "has_spending_data": spending is not None,
                "alert_count": len(alerts),
                "highlight_count": len(highlights),
            },
        )

        return Response(
            {
                "status": "ok",
                "generated_at": timezone.now().isoformat(),
                "highlights": highlights,
                "alerts": alerts,
                "next_action": next_action,
            }
        )


class PersonalCfoDashboardView(APIView):
    """Rich CFO dashboard surfaced after the user completes the CFO checklist.

    Aggregates portfolio, goals, spending, projections, diversification score
    and (optionally) a GPT-generated narrative. Gated by Plus/Pro.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = get_user_plan(request.user)
        if not plan_allows(plan, "plus"):
            return Response(
                {
                    "error": "Requires Plus or Pro plan.",
                    "reason": "upgrade",
                    "feature": "personal_cfo",
                },
                status=402,
            )
        surface = request.query_params.get("surface") or "web"
        cache_key = dashboard_cache_key(request.user.id, surface)
        payload = cache.get(cache_key)
        if payload is None:
            try:
                payload = build_dashboard(request.user, surface=surface)
            except Exception as exc:
                logger.exception("cfo_dashboard_failed user=%s err=%s", request.user.id, exc)
                return Response(
                    {"error": "Could not build dashboard. Please try again."},
                    status=500,
                )
            # Short TTL: the deterministic blocks change slowly, and the AI
            # narrative has its own endpoint + invalidation on generation.
            cache.set(cache_key, payload, CFO_DASHBOARD_CACHE_TTL)
        record_funnel_event(
            "personal_cfo_dashboard_view",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={
                "surface": surface,
                "real_holdings_count": payload.get("context", {}).get("real_holdings_count"),
                "ai_source": payload.get("ai_analysis", {}).get("source"),
            },
        )
        return Response(payload)


class PersonalCfoNarrativeView(APIView):
    """Lightweight AI-narrative poll target.

    The dashboard returns instantly with a deterministic narrative and
    ``ai_analysis.status="pending"``; clients poll this endpoint until the
    background task has cached the AI text (``status="ready"``)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = get_user_plan(request.user)
        if not plan_allows(plan, "plus"):
            return Response(
                {
                    "error": "Requires Plus or Pro plan.",
                    "reason": "upgrade",
                    "feature": "personal_cfo",
                },
                status=402,
            )
        surface = request.query_params.get("surface") or "web"
        try:
            ctx = build_dashboard_context(request.user)
        except Exception as exc:
            logger.exception("cfo_narrative_ctx_failed user=%s err=%s", request.user.id, exc)
            return Response({"error": "Could not resolve narrative."}, status=500)
        return Response(resolve_narrative(request.user, ctx, surface=surface))


class PersonalCfoProgressView(APIView):
    """Backend-driven Personal CFO step completion detection.

    Used by the hub to mark steps complete based on actual user data rather
    than relying on local storage only. Each step still surfaces a hint about
    how the user can advance it.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = get_user_plan(request.user)
        if not plan_allows(plan, "plus"):
            return Response(
                {
                    "error": "Requires Plus or Pro plan.",
                    "reason": "upgrade",
                    "feature": "personal_cfo",
                },
                status=402,
            )
        user = request.user
        has_goal = FinancialGoal.objects.filter(user=user).exists()
        has_real_holding = PortfolioEntry.objects.filter(user=user, is_paper_trade=False).exists()
        has_paper_or_real = PortfolioEntry.objects.filter(user=user).exists()
        from budgeting.models import BudgetEnvelope, Transaction

        has_envelope_or_tx = (
            BudgetEnvelope.objects.filter(user=user, is_active=True).exists()
            or Transaction.objects.filter(user=user).exists()
        )
        # "Savings" is computed when the user has any goal — the calculator
        # itself is stateless, so a saved goal is the strongest persistent
        # signal we have.
        steps = {
            "goals": has_goal,
            "savings": has_goal,
            "budget": has_envelope_or_tx,
            "portfolio": has_real_holding,
            "market": has_paper_or_real,
            "next-steps": has_goal or has_real_holding or has_envelope_or_tx,
        }
        total = len(steps)
        done = sum(1 for v in steps.values() if v)
        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "steps": steps,
                "completion": {
                    "done": done,
                    "total": total,
                    "ratio": (done / total) if total else 0.0,
                    "is_complete": done == total,
                },
            }
        )


class PersonalCfoCoachView(APIView):
    """POST /api/personal-cfo/coach/ — chat turn with the unified AI service (source=cfo_coach)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan = get_user_plan(request.user)
        if not plan_allows(plan, "plus"):
            return Response(
                {
                    "error": "Requires Plus or Pro plan.",
                    "reason": "upgrade",
                    "feature": "personal_cfo",
                },
                status=402,
            )

        if bool(request.data.get("reset")):
            reset_cfo_conversation(request.user)
            return Response({"response": "", "reset": True}, status=200)

        try:
            service = OpenAIService(
                request,
                check_and_consume_entitlement=check_and_consume_entitlement,
                source_override="cfo_coach",
            )
            payload, code = service.handle()
        except Exception as exc:
            logger.exception("cfo_coach_view_failed user=%s err=%s", request.user.id, exc)
            return Response({"error": "Coach unavailable."}, status=500)

        if code == 200:
            record_funnel_event(
                "personal_cfo_coach_message",
                user=request.user,
                platform=resolve_request_platform(request),
                metadata={"surface": request.data.get("surface") or "unknown"},
            )
        return Response(payload, status=code)

    def get(self, request):
        plan = get_user_plan(request.user)
        if not plan_allows(plan, "plus"):
            return Response(
                {
                    "error": "Requires Plus or Pro plan.",
                    "reason": "upgrade",
                    "feature": "personal_cfo",
                },
                status=402,
            )
        return Response(
            {"history": get_conversation_history(request.user, source="cfo_coach", limit=30)}
        )
