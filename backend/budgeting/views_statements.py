"""
Statement import endpoints.

Three-step flow, deliberately stateless between steps:

1. ``GET  /api/budgeting/statements/allowance/`` — limits + free saves left.
2. ``POST /api/budgeting/statements/preview/``   — parse + analyse, persist nothing.
   **Free for every signed-in user.** This is the hook: upload a statement,
   see where the money went, decide whether that is worth paying for.
3. ``POST /api/budgeting/statements/commit/``    — persist. Spends a free save
   on the Starter plan, unlimited on Plus/Pro.

The file is re-sent on commit rather than cached server-side: keeping raw
statement bytes around between two requests is exactly the kind of storage this
feature exists to avoid.

Accepted formats: CSV/TSV, Excel (.xlsx), PDF, and OFX/QFX/QIF. Barclays and
most UK high-street banks only offer PDF beyond the last few months, so PDF is
not optional if the tool is meant to be usable.
"""

from __future__ import annotations

import logging
import os

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.entitlements import get_user_plan
from budgeting.models import StatementImport
from budgeting.serializers import StatementImportSerializer
from budgeting.services import statement_analysis
from budgeting.services.statement_import import (
    commit_statement,
    get_allowance,
    recompute_affected_periods,
    revert_statement,
)
from budgeting.services.statements import (
    DIALECTS,
    StatementParseError,
    parse_statement,
)
from budgeting.throttles import StatementUploadThrottle
from core.request_platform import resolve_request_platform
from finance.utils import record_funnel_event

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = (
    ".csv",
    ".tsv",
    ".txt",
    ".pdf",
    ".xlsx",
    ".ofx",
    ".qfx",
    ".qif",
)


def _safe_filename(name: str) -> str:
    """Keep the basename only, stripped of path components and control chars."""
    base = os.path.basename(str(name or "").strip())
    return "".join(ch for ch in base if ch.isprintable() and ch not in "\\/")[:128]


def _too_large(allowance):
    return Response(
        {
            "error": "file_too_large",
            "message": (
                f"That statement is larger than the {allowance.max_bytes // 1024}KB "
                "limit for your plan."
            ),
            "allowance": allowance.as_dict(),
        },
        status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
    )


def _read_upload(request, allowance):
    """Return ``(bytes, filename)`` or a ``Response`` describing what's wrong.

    Accepts either an uploaded ``file`` or a raw ``text`` field holding pasted
    CSV. The text path exists because mobile clients without a native file
    picker (older builds) still need a way in, and pasting a statement is a
    legitimate flow on its own.

    Never logs or echoes statement content — only names, sizes and error codes.
    """
    upload = request.FILES.get("file")
    if upload is None:
        pasted = request.data.get("text")
        if pasted:
            raw = str(pasted).encode("utf-8")
            if len(raw) > allowance.max_bytes:
                return _too_large(allowance)
            return raw, _safe_filename(request.data.get("filename") or "pasted.csv")
        return Response(
            {
                "error": "no_file",
                "message": "Attach a CSV statement export, or paste its contents.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    filename = _safe_filename(upload.name)
    if filename and not filename.lower().endswith(ALLOWED_EXTENSIONS):
        return Response(
            {
                "error": "unsupported_extension",
                "message": (
                    "Upload a statement your bank exported: CSV, PDF, " "Excel, OFX/QFX or QIF."
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if upload.size and upload.size > allowance.max_bytes:
        return _too_large(allowance)

    raw = upload.read(allowance.max_bytes + 1)
    if len(raw) > allowance.max_bytes:
        return _too_large(allowance)
    return raw, filename


def _parse_error_response(exc: StatementParseError):
    return Response(
        {"error": exc.code, "message": exc.message},
        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


class StatementAllowanceView(APIView):
    """What this user can upload, and how many free saves they have left."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = get_user_plan(request.user)
        allowance = get_allowance(request.user, plan)
        return Response(
            {
                "allowance": allowance.as_dict(),
                "supported_banks": [{"slug": d.slug, "label": d.label} for d in DIALECTS],
                "saved_imports": StatementImport.objects.filter(
                    user=request.user, status=StatementImport.Status.COMPLETED
                ).count(),
            }
        )


class StatementPreviewView(APIView):
    """Parse + analyse a statement without storing anything.

    Available on every plan on purpose — the analysis is the demo.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [StatementUploadThrottle]

    def post(self, request):
        plan = get_user_plan(request.user)
        allowance = get_allowance(request.user, plan)

        result = _read_upload(request, allowance)
        if isinstance(result, Response):
            return result
        raw, filename = result

        try:
            parsed = parse_statement(raw, max_rows=allowance.max_rows)
        except StatementParseError as exc:
            record_funnel_event(
                "statement_preview_failed",
                user=request.user,
                platform=resolve_request_platform(request),
                metadata={"reason": exc.code},
            )
            return _parse_error_response(exc)
        except Exception:
            logger.exception("statement_parse_crashed user=%s", request.user.id)
            return Response(
                {"error": "parse_failed", "message": "Couldn't read that file."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        analysis = statement_analysis.analyze(parsed.rows, currency=parsed.currency)

        record_funnel_event(
            "statement_preview_completed",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={
                "dialect": parsed.dialect_slug,
                "format": parsed.source_format,
                "rows": len(parsed.rows),
                "is_paid": allowance.is_paid,
            },
        )

        return Response(
            {
                "filename": filename,
                "bank": {"slug": parsed.dialect_slug, "label": parsed.dialect_label},
                "source_format": parsed.source_format,
                "currency": parsed.currency,
                "row_count": len(parsed.rows),
                "skipped_rows": parsed.skipped_rows,
                "warnings": parsed.warnings,
                "columns": parsed.column_map,
                "sample": statement_analysis.sample_rows(parsed.rows),
                "analysis": analysis,
                "allowance": allowance.as_dict(),
            }
        )


class StatementCommitView(APIView):
    """Persist a parsed statement into the user's transaction history."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [StatementUploadThrottle]

    def post(self, request):
        plan = get_user_plan(request.user)
        allowance = get_allowance(request.user, plan)

        if not allowance.can_save:
            record_funnel_event(
                "statement_save_blocked",
                user=request.user,
                platform=resolve_request_platform(request),
                metadata={"free_saves_used": allowance.used},
            )
            return Response(
                {
                    "error": "Free statement saves used up.",
                    "reason": "upgrade",
                    "feature": "budget_tracking",
                    "allowance": allowance.as_dict(),
                },
                status=402,
            )

        result = _read_upload(request, allowance)
        if isinstance(result, Response):
            return result
        raw, filename = result

        try:
            parsed = parse_statement(raw, max_rows=allowance.max_rows)
        except StatementParseError as exc:
            return _parse_error_response(exc)
        except Exception:
            logger.exception("statement_parse_crashed user=%s", request.user.id)
            return Response(
                {"error": "parse_failed", "message": "Couldn't read that file."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        statement = commit_statement(
            request.user,
            parsed,
            filename=filename,
            is_trial=not allowance.is_paid,
        )
        try:
            recompute_affected_periods(request.user, statement)
        except Exception:
            logger.exception(
                "statement_summary_recompute_failed user=%s import=%s",
                request.user.id,
                statement.id,
            )

        after = get_allowance(request.user, plan)
        record_funnel_event(
            "statement_saved",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={
                "dialect": parsed.dialect_slug,
                "format": parsed.source_format,
                "created": statement.created_count,
                "duplicates": statement.duplicate_count,
                "is_trial": statement.was_trial,
            },
        )

        return Response(
            {
                "import": StatementImportSerializer(statement).data,
                "analysis": statement_analysis.analyze(parsed.rows, currency=parsed.currency),
                "allowance": after.as_dict(),
                "saved_at": timezone.now().isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


class StatementImportViewSet(viewsets.ReadOnlyModelViewSet):
    """History of saved imports, plus an undo that hard-deletes their rows."""

    serializer_class = StatementImportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return StatementImport.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        statement = self.get_object()
        deleted = revert_statement(request.user, statement)
        try:
            recompute_affected_periods(request.user, statement)
        except Exception:
            logger.exception(
                "statement_revert_recompute_failed user=%s import=%s",
                request.user.id,
                statement.id,
            )
        record_funnel_event(
            "statement_import_reverted",
            user=request.user,
            platform=resolve_request_platform(request),
            metadata={"deleted": deleted},
        )
        return Response({"ok": True, "deleted": deleted}, status=status.HTTP_200_OK)
