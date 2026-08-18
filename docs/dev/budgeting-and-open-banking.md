# Budgeting, statement import, and open banking

Written 2026-08-18. Covers `backend/budgeting/`, the Personal CFO tool surface on both clients, and
the open-banking abstraction. This is the newest and most actively-changed area of the codebase and
had no dev doc before.

Related: [`../banking/open-banking-plan.md`](../banking/open-banking-plan.md) (the go/no-go plan),
[`../audit/platform-audit-2026-08.md`](../audit/platform-audit-2026-08.md) §2.2, §2.3, §5.

## What is actually live

**Statement import is shipped and is the most-tested code in the repo** (54 test cases in
`backend/tests/test_statement_import.py`). **Open banking is not** — the provider layer exists, the
Plaid implementation is a stub, and `BUDGETING_PROVIDER` defaults to `disabled` everywhere.

| Capability | State |
| --- | --- |
| Upload CSV / TSV / Excel / PDF / OFX / QFX / QIF | shipped |
| Parse + normalize into `Transaction` rows | shipped |
| Auto-categorization | shipped (`services/categorization.py`, 754 lines) |
| AI insight over a statement | shipped (`services/statement_ai.py`) |
| Budget envelopes + period summaries | shipped |
| Spending anomalies | shipped |
| Personal CFO dashboard / narrative / coach | shipped (Plus/Pro) |
| Weekly CFO report email | shipped (Mon 09:00 Celery beat) |
| **Bank account linking** | **stubbed** — UI says "Bank connections are coming soon" |
| Category override / per-user merchant rules | not built |
| Multi-statement month-over-month trends | not built |
| Export a saved analysis | not built |

## Models (`backend/budgeting/models.py`)

`LinkedAccount:22` · `StatementImport:66` · `TransactionCategory:106` · `Transaction:133` ·
`BudgetEnvelope:211` · `BudgetPeriodSummary:235` · `SpendingAnomaly:257` · `ProviderWebhookEvent:290`

> ⚠️ `LinkedAccount` stores provider tokens **in plaintext**. The table is still empty in every
> environment because linking is disabled — which makes now the cheap moment to add an
> `EncryptedTextField` (audit §2.3).

## Endpoints (`backend/budgeting/urls.py`)

Routers: `budgeting/linked-accounts`, `budgeting/transactions`, `budgeting/envelopes`,
`budgeting/statements`.

Statement flow: `budgeting/statements/allowance/` → `preview/` → `commit/` → `insight/`.
Analysis: `budgeting/spending-summary/`, `budgeting/anomalies/`.
Provider: `budgeting/provider-status/`, `provider/link-token/`, `provider/webhook/`.
Personal CFO: `personal-cfo/summary|dashboard|narrative|progress|coach/`.

> The statement history list is **unpaginated**, and DRF has no default pagination configured
> (audit §2.2). The transaction queryset also lacks `select_related("category")` (§4.2).

## The paywall

Statement import is deliberately **free to try, paywalled on save**. Both tool registries mark it
free (`frontend/src/components/tools/toolsRegistry.ts:77-78`), and the limit is enforced
server-side by the allowance endpoint against:

- `BUDGETING_FREE_STATEMENT_BYTES` / `_IMPORTS` / `_ROWS` — the free-tier allowance
- `BUDGETING_MAX_STATEMENT_BYTES` / `_ROWS` — the hard ceiling for every plan
- `STATEMENT_UPLOAD_THROTTLE_RATE` — the DRF throttle scope

This is an activation surface: the user gets the whole analysis, then hits the wall at save. Don't
"fix" the free entry point.

## Open banking — how far the abstraction goes

`backend/budgeting/services/providers.py`:

- `DisabledProvider` (`:85-108`) — the default. Returns empty lists for everything.
- `PlaidProvider` (`:111`) — a skeleton:
  - `create_link_url` returns a **fake** `link.plaid.com/?token=PENDING_USER_<id>` (`:141`)
  - `exchange_public_token` raises `NotImplementedError` — the only one in the backend (`:146-147`)
  - `list_accounts` / `fetch_transactions` return `[]`
  - webhook signature verification defaults to **reject-all** (`:80-82`)
- **No TrueLayer, GoCardless, or Tink code exists**, despite the module docstring naming them (`:6`).

Consequence: the 6-hourly `budgeting.tasks.sync_linked_accounts_task` runs and syncs nothing in
every current environment. `ProviderWebhookEvent` never gets a row.

Client behaviour when disabled: the backend reports `providerStatus.enabled = false`, and
`frontend/src/components/tools/BudgetPlanner.tsx:196,209-212` renders
"Bank connections are coming soon. You can still create budgets and use CSV import."
(string at `packages/core/src/locales/en/common.json:1164`, with the `ro` counterpart).

### To actually enable a provider

1. Implement `exchange_public_token`, `list_accounts`, `fetch_transactions` and real webhook
   signature verification on `PlaidProvider`.
2. Encrypt `LinkedAccount` token fields **before** the table has rows.
3. Set `BUDGETING_PROVIDER=plaid`, `BUDGETING_REGION`, `PLAID_CLIENT_ID`, `PLAID_SECRET`,
   `PLAID_ENV`, `PLAID_WEBHOOK_SECRET`.
4. Add tests — `budgeting/` currently has no app-level test module; `providers.py` and
   `categorization.py` are untested.

## Celery

| When | Task |
| --- | --- |
| every 6h at :15 | `budgeting.tasks.sync_linked_accounts_task` (no-op while disabled) |
| 03:00 | `budgeting.tasks.recompute_summaries_task` |
| Mon 09:00 | `budgeting.tasks.send_weekly_cfo_reports` |
| event-driven | `budgeting.tasks.generate_cfo_narrative_task` |

In production Beat reads the `PeriodicTask` table, not the static schedule in
`backend/settings/celery.py` — see [`architecture.md`](architecture.md).

## Clients

| Surface | Web | Mobile |
| --- | --- | --- |
| Statement import | `frontend/src/components/tools/StatementImport.tsx` (917 L) | `mobile/app/tools/statement-import/index.tsx` (1105 L) |
| Budget planner | `components/tools/BudgetPlanner.tsx` | `app/tools/budget-planner/` |
| Personal CFO | `components/tools/CFODashboard.tsx` (778 L) | `app/tools/personal-cfo/` (814 L) |
| CFO coach | — | `app/tools/personal-cfo-coach/` (464 L) — **mobile only** |

Mobile's document picker is lazily `require`d (`statement-import/index.tsx:49-63`) so older
binaries without `expo-document-picker` degrade instead of crashing.

## Gotchas

- File parsing is 1,268 lines in `services/statements.py`. Add a format there, not in the view.
- Filenames from some banks arrive mis-encoded; migration
  `budgeting/migrations/0005_decode_statement_filenames.py` exists for that. See
  [`encoding-and-user-display.md`](encoding-and-user-display.md).
- `services/statement_ai.py` calls OpenAI — every call needs an explicit timeout (backend rule).
- Categorization rules are heuristic and per-merchant. The audit's top product recommendation
  (§5.1) is user-editable overrides applied retroactively; nothing in the current schema stores a
  user correction.
