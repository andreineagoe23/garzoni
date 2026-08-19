"""Pagination for the budgeting lists that grow without bound.

Deliberately *not* wired up as DRF's ``DEFAULT_PAGINATION_CLASS``. Turning
pagination on globally changes every list response from a bare array to
``{count, next, previous, results}``, and this API has 17 list endpoints with
roughly 150 client call sites across web and mobile — most of which index the
response directly. A global switch would break them silently, in production,
on read paths that currently work.

The two lists here are the ones that actually grow per user, and both are safe:
``budgeting/statements`` is consumed by clients that already accept either shape
(``data?.results ?? data ?? []``), and ``budgeting/transactions`` has no client
consumers at all. See docs/audit/platform-audit-2026-08.md §2.2.
"""

from rest_framework.pagination import PageNumberPagination


class BudgetingPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200
