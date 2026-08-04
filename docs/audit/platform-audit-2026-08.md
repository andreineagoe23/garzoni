# Platform audit + improvement plan (2026-08-03)

> **Status 2026-08-03 — Sprint 1 (§6) is implemented on branch `sprint1-platform-hardening`.**
> Django is on 5.2.16 LTS, all six floating deps are pinned with a CI guard, `backend/railway.json`
> gates deploys on `/health/`, and the prerender retries transient backend failures.
> The upgrade surfaced a latent production bug the audit had not predicted: **10 call sites used
> `django.utils.timezone.utc`, removed in Django 5.0** — all of them in Stripe webhook / subscription /
> RevenueCat-renewal code, i.e. exactly the barely-tested money path from §3.2. Fixed as part of the
> upgrade. See §9 for what shipped and what is still open.

Scope: whole app — `backend/`, `frontend/`, `mobile/`, `packages/`, plus the Railway/Vercel/Cloudflare
production topology. Written after the statement-import work landed (`6e3342c2`).

Every claim below was verified against the tree at `6e3342c2` or against live production data.
Where something is *latent* (wrong code, no user hitting it) it says so — that distinction drives
the priority order in §6 and is the main reason this plan is not just "fix all the findings."

Related: [`docs/banking/open-banking-plan.md`](../banking/open-banking-plan.md),
[`docs/ux/missions-audit-2026-08.md`](../ux/missions-audit-2026-08.md),
[`docs/analytics/`](../analytics/), [`docs/seo/`](../seo/).

---

## 0. Verdict first

The codebase is in good shape. There is no fire. The three things that actually matter:

1. **Django 4.2 is past end-of-life.** Extended support ended April 2026; today is August 2026.
   You are running an unpatched web framework in production. Nothing else on this list outranks it.
2. **Deploys emit 502s on the exact endpoints the SEO prerender depends on.** Measured, not theorised
   (§2.1). Every deploy is a chance to poison a bot snapshot you spent six phases building.
3. **Statement import is feature-complete but has no second-session hook.** Users can import, but
   cannot correct a category and cannot compare two months. Those are the two things that turn a
   one-time demo into a returning-user loop (§5).

Everything else is real but can wait.

---

## 1. System map (verified state)

**Shape.** pnpm monorepo. Django 4.2 + DRF backend on Railway (web + worker + beat + Postgres + Redis),
Vite/React 19 web on Vercel, Expo 54 / RN 0.81 mobile, `packages/core` shared logic + i18n,
`packages/tokens` design tokens.

| Surface | Size | Tests |
|---|---|---|
| backend (app code, excl. migrations/venv) | ~65k lines | ~7.8k lines |
| frontend `src/` | ~49k lines | 22 test files |
| mobile | ~56k lines | 13 test files |
| `packages/core` | 64 modules | — |

**Domain models.** education 32, gamification 13, finance 11, budgeting 8, support 6,
authentication 4, notifications 2, onboarding 2.

**i18n.** EN and RO at exact key parity (3044 / 3044). 84 of 149 web components call `useTranslation`;
no hardcoded user-facing strings found in `components/tools/`. This is healthy — leave it alone.

**Production, as of this audit.**

- Railway web service: Railpack builder, root `/backend`, start command still carries a dead
  `--timeout 300` (see §3.4). Effective runtime from the deploy log: `workers=3 threads=8 timeout=90s`.
- Latest deploy `55857a6d` (commit `6e3342c2`) = **SUCCESS**. pdfplumber/openpyxl are live.
  The "Railway needs a deploy" item from the statement-import work is **closed**.
- `master` is pushed; `origin/master..master` is empty. That item is **closed** too.
- No deploy-log errors on the previous revision. Gunicorn boot is clean.

---

## 2. P0 — wrong now, and someone is hitting it

### 2.1 Deploys 502 the public content API

**Evidence.** Production HTTP log, rollover window at 21:50 UTC on 2026-08-03:

```
GET /api/public/lessons/cash-flow-analysis/           502   2ms
GET /api/public/lessons/maximizing-rental-returns/    502   1ms
GET /api/public/lessons/managing-rental-expenses/     502   1ms
GET /api/public/lessons/how-compound-interest-works/  502   1ms
GET /api/public/lessons/short-term-vs-long-term-goals/ 502  1ms
...8 total, then:
GET /api/public/lessons/creating-an-action-plan/      200 4705ms
GET /api/public/lessons/cash-flow-analysis/           200 4746ms
GET /api/public/lessons/how-compound-interest-works/  200 2525ms
```

Two distinct problems in one window:

- **No health-gated rollover.** The old container stops accepting before the new one is ready, so
  requests land on nothing. `railway.json` does not exist in the repo, so `healthcheckPath` is either
  unset or set only in the dashboard where it is not version-controlled. A `/health/` endpoint already
  exists ([`settings/urls.py:28`](../../backend/settings/urls.py#L28)) and is already excluded from
  access logs ([`gunicorn.conf.py`](../../backend/gunicorn.conf.py)) — it is ready to be used, it just
  isn't wired to the deploy gate.
- **Cold-start latency of 2.5–4.7s** on the first request per lesson slug after boot, settling to
  16–39ms once warm.

**Why it matters more than a normal 502.** Those paths are what the Vercel bot-prerender fetches to
build SEO snapshots (see [`docs/seo/`](../seo/) and the prerender API-interception work). A 502 during
prerender produces a snapshot with missing content, which is worse than a slow one.

**Fix.**

1. Add `backend/railway.json` with `deploy.healthcheckPath = "/health/"` and a sane
   `healthcheckTimeout`, so the gate lives in git.
2. Retry-with-backoff on the prerender's API fetch (2 attempts, 500ms) — cheap insurance regardless.
3. Warm the public-lesson cache in `docker/entrypoint.sh` after boot, or put a Cloudflare cache rule on
   `/api/public/*`. The second also fixes the cold-start LCP for real users.

**Effort:** S (half day). **Risk:** low.

### 2.2 Statement history list is unpaginated

[`views_statements.py:320-330`](../../backend/budgeting/views_statements.py#L320-L330) —
`StatementImportViewSet` is a `ReadOnlyModelViewSet` with no pagination class, and DRF has **no global
pagination configured** (`settings.py` defines no `DEFAULT_PAGINATION_CLASS` / `PAGE_SIZE`). This is
live: clients call `budgeting/statements/` in six places across web and mobile.

Today the list is small. It grows one row per save forever, with no cap and no cursor.

**Fix.** Set a DRF default page size (say 50) and audit the 17 viewsets for clients that assume a bare
array vs `{results: []}`. Doing it globally is the right call — doing it per-view leaves the same trap
for the next endpoint.

**Effort:** S–M. **Risk:** medium — it changes response shape, so client call sites must be checked.

### 2.3 `LinkedAccount` tokens are plaintext

[`budgeting/models.py:46-47`](../../backend/budgeting/models.py#L46-L47):

```python
encrypted_access_token = models.TextField(blank=True)
encrypted_refresh_token = models.TextField(blank=True)
```

The field names assert an encryption that does not exist. The docstring above them says any token
"MUST be stored using the field helpers below (`encrypted_*`)" — there are no helpers.

Harmless *today*: the provider is disabled, so no real token has ever been written
([`services/providers.py:146`](../../backend/budgeting/services/providers.py#L146) is still a stub),
and the admin already excludes both fields ([`budgeting/admin.py:19`](../../backend/budgeting/admin.py#L19)).

The reason to fix it now rather than at open-banking time: **`cryptography>=41` is already a
dependency** ([`requirements.txt:37`](../../backend/requirements.txt#L37)). A Fernet-backed custom
field is roughly 30 lines and no new package. Doing it while the table is empty means zero data
migration. Doing it later means a migration over live financial credentials.

**Fix.** `EncryptedTextField(models.TextField)` with `from_db_value` / `get_prep_value` over
`Fernet(settings.FIELD_ENCRYPTION_KEY)`; key from env, rotation via `MultiFernet`. Swap both fields,
generate the (no-op) migration.

**Effort:** S. **Risk:** low while the table is empty — which is precisely the argument for now.

---

## 3. P1 — platform risk

### 3.1 Django 4.2.30 is EOL

`Django==4.2.30` ([`requirements.txt:15`](../../backend/requirements.txt#L15)). Django 4.2 LTS
extended support ended **April 2026**. No further security releases. Target is **Django 5.2 LTS**
(supported to April 2028).

**Known-compatible already:** DRF 3.17.1, `djangorestframework-simplejwt` 5.5.1,
`django-cors-headers` 4.6, `django-celery-beat` 2.7, `whitenoise` 6.8, `sentry-sdk` 2.19.

**Verify before starting** — these four are the likely friction, none confirmed either way yet:

| Package | Pinned | Why it's on the list |
|---|---|---|
| `django-ckeditor-5` | 0.2.12 | small maintainer, admin-only surface |
| `django-rest-passwordreset` | 1.5.0 | touches auth; there are already two reset systems (see auth audit) |
| `django-cloudinary-storage` | 0.3.0 | storage API changed in Django 4.2→5.x |
| `jsonfield` | 3.1.0 | superseded by native `JSONField`; possibly droppable outright |

**Also:** `pytz==2024.2` is pinned. Django 5.0 removed `USE_DEPRECATED_PYTZ`. `django-timezone-field`
7.0 should already be zoneinfo-based — confirm nothing in app code imports `pytz` directly.

**Plan.** 4.2 → 5.0 → 5.1 → 5.2, running the full suite at each hop, rather than one jump. 406 backend
tests is enough of a net to make this safe. Do it on a branch, deploy to the Railway test service
([`docs/dev/railway-test-service.md`](../dev/railway-test-service.md)) before production.

**Effort:** M (1–2 days including dependency bumps). **Risk:** medium, well-contained by the suite.

### 3.2 Stripe webhook is the least-tested high-consequence code

[`finance/views.py:1966-2424`](../../backend/finance/views.py#L1966-L2424) — ~460 lines handling the
money path. Test coverage is **two tests**, both `customer.subscription.updated`
([`finance/tests_subscriptions.py`](../../backend/finance/tests_subscriptions.py)):
`past_due` keeps premium, `canceled` downgrades to starter.

Untested: `checkout.session.completed`, `invoice.payment_failed`, signature-verification failure,
duplicate/replayed event ids, out-of-order delivery, unknown-customer events.

Given billing runs through RevenueCat *and* Stripe (see
[`docs/prod/billing-parity-runbook.md`](../prod/billing-parity-runbook.md)), a webhook bug is a silent
entitlement bug — the worst kind, because the user notices before you do.

**Fix.** Fixture-driven tests, one per handled event type, plus an idempotency test that fires the same
event id twice and asserts one ledger effect. Write these **before** the §4.1 refactor so the split is
verifiable.

**Effort:** M. **Risk:** none (additive).

### 3.3 Unpinned dependencies

```
setuptools>=83.0.0   cryptography>=41.0.0   openai>=1.35.0
pgvector>=0.3.0      groq>=0.12.0           django-anymail[resend]   (no bound at all)
```

Six unbounded specifiers with no lockfile. A breaking `openai` minor lands straight into a production
rebuild with no code change on your side — and `openai` is called from eight modules including the
statement AI, the tutor, and the CFO coach.

**Fix.** Pin all six to the resolved version (`pip freeze` inside the built image), then adopt
`pip-compile` or `uv lock` so `requirements.txt` becomes a lockfile with an `.in` source of truth.

**Effort:** S. **Risk:** low. **Do this the same day as §3.1** — an unpinned dep during a framework
upgrade turns one variable into two.

### 3.4 Runtime drift and a dead flag

- Local `.venv` is **Python 3.14**; `backend/Dockerfile:5` is `python:3.12-alpine3.23`. Local test runs
  do not exercise the production interpreter. Align the local venv to 3.12, or move local test runs
  into Docker as the default (the Makefile path already exists).
- The Railway start command still ends with `--timeout 300`. It is **dead** — `docker/entrypoint.sh`
  appends `--timeout ${GUNICORN_TIMEOUT:-90}` after it and later args win — but it reads as though
  production allows 300s requests. Remove it from the start command so the config says what it does.

**Effort:** S. **Risk:** none.

### 3.5 Web refresh token in `sessionStorage`

[`AuthContext.tsx:179`](../../frontend/src/contexts/AuthContext.tsx#L179) — XSS-readable. Raised in the
July auth and security audits; still open. The mitigation is an httpOnly, `Secure`, `SameSite=Lax`
cookie for the **refresh** token only, keeping the access token in memory. Requires a CSRF story for the
refresh endpoint, which is why it keeps getting deferred.

**Effort:** M. **Risk:** medium (touches every auth path on web). Not urgent given CSP is in place;
schedule it, don't rush it.

---

## 4. P2 — code health

### 4.1 `finance/views.py` is three unrelated services in one file

3968 lines. It contains:

| Concern | Rough span |
|---|---|
| Market data scraping (Yahoo session/crumb, Stooq, CoinGecko, news RSS) | `212–1102` |
| Market/quote/search/paper-trade endpoints | `1102–1889` |
| Stripe billing lifecycle (webhook, create/change/cancel/portal/sync/verify) | `1966–3357` |
| Funnel analytics ingest + metrics | `3357–3814` |

Split into `views_market.py`, `views_billing.py`, `views_analytics.py` with the scraping helpers moved
to `finance/services/market/`. Pure moves, no behaviour change. The payoff is that the billing code
becomes reviewable on its own — which matters most because it is the money path and the least tested.

Do this **after** §3.2 so the tests prove the move was clean.

[`education/views.py`](../../backend/education/views.py) is 3416 lines with the same problem; same fix,
lower urgency.

**Effort:** M. **Risk:** low if tests land first.

### 4.2 Latent: transaction list has an N+1 and a silent truncation

[`serializers.py:49-52`](../../backend/budgeting/serializers.py#L49-L52) resolves `obj.category` per row
with no `select_related`, and [`views.py:118-126`](../../backend/budgeting/views.py#L118-L126) ends in a
hard `[:500]` slice with no cursor and no "there is more" signal.

**No client calls `budgeting/transactions/`.** Confirmed by grepping every `budgeting/*` path used
across `frontend/src`, `mobile/`, and `packages/`: only `statements/`, `envelopes/`,
`spending-summary/`, `linked-accounts/`, `provider-status/` and `provider/link-token/` are used.

So this is a trap, not a bug. Fix it anyway — `select_related("category")` is one line — but it does not
justify a slot ahead of anything in §2 or §3. The truncation resolves itself under §2.2.

The path users *do* hit, `analyze_saved_import`
([`statement_analysis.py:500-526`](../../backend/budgeting/services/statement_analysis.py#L500-L526)),
was checked and is clean: it touches no FK, so there is no N+1 there.

**Effort:** XS.

### 4.3 Market data rests on an unofficial API

[`finance/views.py`](../../backend/finance/views.py) hits `query2.finance.yahoo.com` (5 call sites) and
`finance.yahoo.com` (3), including a cookie/crumb session dance
(`_yahoo_get_session`, `:329`), with Stooq (`:395`) and CoinGecko as fallbacks. Unofficial,
terms-of-service grey, and it breaks without warning when Yahoo rotates its scheme.

Portfolio Analyzer and Market Explorer both sit on it — on web and mobile.

There is real defensive engineering already there (multi-provider fallback, quote-miss caching,
`_quote_miss_cache_seconds`), so this is not fragile by accident. Two honest options:

- **Accept it.** Add a user-visible staleness indicator when every provider misses, so a silent Yahoo
  break degrades visibly instead of showing stale numbers as current. Cheap.
- **Pay for it.** Put a licensed provider behind a feature flag, keeping the current chain as fallback.
  Only worth it at a subscriber count that makes the bill rounding error — the same gate logic as
  [`docs/banking/open-banking-plan.md`](../banking/open-banking-plan.md).

**Recommendation:** the first now, the second at the same revenue gate as open banking.

### 4.4 Client monoliths

[`ExercisePage.tsx`](../../frontend/src/components/exercises/ExercisePage.tsx) 3131 lines,
[`CourseFlowPage.tsx`](../../frontend/src/components/courses/CourseFlowPage.tsx) 2303,
[`mobile/app/subscriptions.tsx`](../../mobile/app/subscriptions.tsx) 2277,
[`PortfolioAnalyzer.tsx`](../../frontend/src/components/tools/PortfolioAnalyzer.tsx) 1780.

Not urgent. Worth splitting opportunistically when next touched — not as a project.

---

## 5. Product — where the leverage is

Ranked by return per unit of work. These are proposals, not defects.

### 5.1 Category override + per-user merchant rules — **do this first**

`TransactionViewSet` is `ReadOnlyModelViewSet`. Categorisation went from 93% "Other" to 2% on a real
Barclays statement, which is very good — but the remaining 2% is **unfixable by the user**, and there
is no correction signal flowing back.

Every budgeting product lives or dies on this. A miscategorised row is the single most noticeable
failure mode, and being unable to fix it reads as "this tool is wrong" rather than "this tool is 98%
right."

**Build:** `PATCH /api/budgeting/transactions/<id>/` accepting `category_slug` only; a
`UserCategoryRule(user, merchant_normalised, category)` table; `categorize()` consults user rules before
the keyword table. `normalise_merchant()`
([`categorization.py:141`](../../backend/budgeting/services/categorization.py#L141)) already produces
the key this needs. Apply a new rule retroactively to that user's existing rows.

**Effort:** M. **Return:** high.

### 5.2 Multi-statement trends

`StatementImport` already stores `period_start` / `period_end` per import, and `analyze_saved_import`
re-derives analysis from stored rows. Every import is still analysed in isolation.

Month-over-month across saved imports — "eating out is up 34% vs June" — is the thing that makes a user
upload a **second** statement. That second upload is the actual retention loop for this feature, and it
is also the moment the paywall (1 free save) does its job.

This is aggregation over data you already have. No parsing work.

**Effort:** M. **Return:** high.

### 5.3 Statement import as an activation surface

The analytics audit flagged an activation cliff, and the UX audit flagged paywall-after-first-lesson as
open. Statement import is the only tool in the app that produces a **personal, non-generic** result in
under a minute, and analysis is deliberately free and unlimited for everyone.

Right now it sits in the tools hub, which is a place users reach after they are already engaged.

**Proposal:** offer it as an onboarding branch — "see where your money actually went, before your first
lesson." Do not force it; a skippable second option next to the questionnaire. Instrument it as its own
funnel arm against the existing `statement_preview_completed` / `statement_saved` events so the
comparison is measurable rather than argued about.

**Effort:** M. **Return:** potentially the highest on this list, and the most uncertain. Ship it as an
experiment with a kill switch, not as a redesign.

### 5.4 Receipt scan → transaction

[`support/views_scan.py`](../../backend/support/views_scan.py) already does OCR through OpenAI vision
for another feature. Wiring it into budgeting closes the gap between statements (monthly, lagging) and
daily spending, and gives a between-statements reason to open the app.

Reuses the existing endpoint, throttle, and entitlement plumbing.

**Effort:** M. **Return:** medium.

### 5.5 Export a saved analysis

No CSV/PDF export exists. It is the most-requested feature of any budgeting tool and it is a day of
work against `analyze_saved_import`, which already returns the full structure.

**Effort:** S. **Return:** medium.

### 5.6 Not recommended right now

- **Open banking.** Unchanged from [`docs/banking/open-banking-plan.md`](../banking/open-banking-plan.md).
  Revisit at ~150 subs / £1k MRR.
- **Paid market-data provider.** Same gate (§4.3).
- **A fourth AI surface.** There are already three (tutor, CFO coach, statement insight) plus scan,
  voice, and smart-resume. Deepen those before adding another.

---

## 6. Sequenced plan

Ordered by risk retired per day of work, not by severity label.

### Sprint 1 — stop the bleeding (~2–3 days)

| # | Item | § | Effort |
|---|---|---|---|
| 1 | Pin the six unbounded deps; add `.in` + lockfile | 3.3 | S |
| 2 | Django 4.2 → 5.0 → 5.1 → 5.2 LTS, suite green at each hop | 3.1 | M |
| 3 | `railway.json` with `healthcheckPath=/health/`; drop dead `--timeout 300` | 2.1, 3.4 | S |
| 4 | Prerender fetch retry + Cloudflare cache rule on `/api/public/*` | 2.1 | S |

Gate: full suite (406 backend / 88 web / 88 mobile / 36 core) + a test-service deploy before production.

### Sprint 2 — make the money path safe (~2–3 days)

| # | Item | § | Effort |
|---|---|---|---|
| 5 | Stripe webhook tests: per-event-type + idempotency + bad signature | 3.2 | M |
| 6 | `EncryptedTextField` on `LinkedAccount` while the table is empty | 2.3 | S |
| 7 | DRF default pagination + audit the 17 viewsets' client call sites | 2.2 | S–M |
| 8 | `select_related("category")` on the transaction queryset | 4.2 | XS |

### Sprint 3 — the product loop (~1 week)

| # | Item | § | Effort |
|---|---|---|---|
| 9 | Category override + per-user merchant rules, applied retroactively | 5.1 | M |
| 10 | Multi-statement month-over-month trends | 5.2 | M |
| 11 | Export a saved analysis (CSV + PDF) | 5.5 | S |

### Sprint 4 — structure and experiments

| # | Item | § | Effort |
|---|---|---|---|
| 12 | Split `finance/views.py` into market / billing / analytics | 4.1 | M |
| 13 | Statement import as an onboarding branch, behind a flag | 5.3 | M |
| 14 | Market-data staleness indicator | 4.3 | S |
| 15 | Align local Python to 3.12, or default local tests to Docker | 3.4 | S |

### Backlog (scheduled, not urgent)

- Refresh token → httpOnly cookie (§3.5)
- Split `education/views.py` (§4.1)
- Receipt scan → transaction (§5.4)
- Client monolith splits, opportunistically (§4.4)

---

## 7. Verification

Commands to re-derive the main claims in this document.

```bash
# Deploy state + the 502 window
railway logs --service garzoni --type http --lines 60

# Confirm no client calls the transactions endpoint (§4.2)
grep -rhoE "budgeting/[a-zA-Z0-9/_-]*" frontend/src mobile packages --include="*.ts*" \
  | sort | uniq -c | sort -rn

# Unbounded dependency specifiers (§3.3)
grep -n ">=" backend/requirements.txt

# Stripe webhook test coverage (§3.2)
grep -rn "def test_" backend/finance/tests_subscriptions.py

# Pagination: expect no output (§2.2)
grep -n "PAGE_SIZE\|DEFAULT_PAGINATION_CLASS" backend/settings/settings.py

# i18n key parity (§1)
python3 -c "import json;f=lambda o:sum(f(v) if isinstance(v,dict) else 1 for v in o.values());\
print([f(json.load(open(p))) for p in ['packages/core/src/locales/en/common.json',\
'packages/core/src/locales/ro/common.json']])"
```

---

## 8. What this audit did not cover

Stated so the gaps are not mistaken for clean bills of health:

- **No test run.** Backend tests need Docker; the counts quoted (406/88/88/36) are from the prior
  session's run at `ef785add`, not re-verified here.
- **No load or query profiling.** The N+1 in §4.2 was read from code, not measured. There may be others
  in `education/views.py` and `gamification/views.py`, which were not read line by line.
- **No mobile device pass.** The Android UI/UX audit items from July were not re-checked.
- ~~**No dependency CVE scan.**~~ **Correction:** CI already runs `pip-audit -r backend/requirements.txt`
  and `pnpm audit --audit-level=high` (the latter with `continue-on-error`). §3.1 and §3.3 were about
  support status and pinning, not known CVEs, and those remain the real gaps.
- **No accessibility audit.** [`docs/dev/frontend-accessibility.md`](../dev/frontend-accessibility.md)
  exists; conformance against it was not tested.

---

## 9. Sprint 1 implementation record (2026-08-03)

Branch `sprint1-platform-hardening`. All gates green: **406 backend / 88 web / 88 mobile / 36 core**
tests, typecheck, eslint, prettier, black, no migration drift, clean Docker image build, and a real
prerender run emitting 73 pages.

### 9.1 Dependency pinning (§3.3)

| Package | Was | Now |
|---|---|---|
| `setuptools` | `>=83.0.0` | `==83.0.0` |
| `cryptography` | `>=41.0.0` | `==50.0.0` |
| `openai` | `>=1.35.0` | `==2.28.0` |
| `pgvector` | `>=0.3.0` | `==0.5.0` |
| `groq` | `>=0.12.0` | `==1.1.1` |
| `django-anymail[resend]` | *(no bound at all)* | `==14.0` |

Versions were taken from `pip freeze` inside the built production image, so the pins record what
production was already running — this changed nothing at runtime, it only stopped the drift.

A **"Dependency pinning"** step in `.github/workflows/ci.yml` now fails the build if any
non-comment line in `requirements.txt` lacks `==`, and the file carries a header explaining why.

`requirements.in` + `pip-compile` were considered and **not** done: `requirements.txt` is already a
fully pinned list, and adding a second file without adopting the tooling creates two things that can
drift instead of one. The CI guard delivers the same protection at a fraction of the risk. Adopting
`uv lock` properly is a separate piece of work.

### 9.2 Django 4.2.30 → 5.2.16 LTS (§3.1)

Hops run individually with the full suite at each: **5.0.14 OK → 5.1.15 OK → 5.2.16 OK**, then the
image was rebuilt from scratch and the suite re-run on a clean install to prove it wasn't an artefact
of incremental `pip install`.

**The removed-API bug.** `django.utils.timezone.utc` was deprecated in Django 4.1 and **removed in
5.0**. Ten call sites still used it, every one in billing code:

- `finance/views.py` — Stripe webhook trial/period handling (×4), `VerifySessionView`,
  `_stripe_subscription_ui_snapshot` (×2), `SubscriptionSyncView`, `SubscriptionCancelView`
- `authentication/tasks.py:442` — RevenueCat renewal date

Each would have raised `AttributeError` in production. **The test suite did not catch a single one** —
they sit behind the Stripe webhook, which §3.2 identifies as having two tests total. This is the
concrete argument for Sprint 2 item 5: the upgrade was safe only because the removed symbol was
greppable. Fixed by switching to `datetime.timezone.utc` (already imported as `datetime_timezone` in
`finance/views.py`; added as `dt_timezone` in `tasks.py`).

Also removed while in there: `datetime.utcfromtimestamp` in the webhook and `datetime.utcnow` in
`support/services/openai.py:73` — both deprecated in Python 3.12.

**`django-celery-beat` 2.7.0 → 2.9.0.** 2.7.0 declares `Django<5.2` and was the only package in the
tree with an upper bound below 5.2 (verified by reading `Requires-Dist` for every installed
distribution — `pip show` does *not* surface the specifier, which is why the audit's "verify these
four first" list missed it). 2.9.0 allows `Django<6.1` and adds no new migrations.

The four packages the audit flagged as likely friction — `django-ckeditor-5`,
`django-rest-passwordreset`, `django-cloudinary-storage`, `jsonfield` — all turned out to be fine.
`pytz` is still pinned but nothing imports it directly. Settings needed no changes: `STORAGES`,
`USE_TZ` and `DEFAULT_AUTO_FIELD` were already in their modern form.

### 9.3 Deploy healthcheck gate (§2.1)

Added [`backend/railway.json`](../../backend/railway.json) — see the deploy-config table in
[`docs/prod/railway-production-runbook.md`](../prod/railway-production-runbook.md) for the field-by-field
reasoning.

**The trap this nearly walked into:** Railway performs healthchecks from the hostname
`healthcheck.railway.app`. Django answers `DisallowedHost` 400 for unrecognised hosts, so adding
`healthcheckPath` *without* allowlisting that host would have made **every deploy fail** at the
healthcheck timeout. `settings.py` now appends it unconditionally, verified by evaluating the settings
module under production-shaped env (`DEBUG=False`, no allow-all) and asserting the host is present.

The dead `--worker-class gthread --workers 2 --threads 4 --timeout 300` tail is gone from the start
command. It was already inert — `docker/entrypoint.sh` appends its own flags afterwards and gunicorn
takes the last one — which the production log confirms (`timeout=90s` while the start command said
300). Removing it makes the config state what it does.

`preDeployCommand` deliberately stays in the dashboard; the reasoning is in the runbook.

### 9.4 Prerender resilience (§2.1)

`frontend/scripts/prerender.mjs` gained `fetchWithRetry` — 3 attempts, 500ms/1000ms backoff, retrying
network errors and 5xx but **not** 4xx (a 404 is a real answer, and retrying it would only slow the
build). Applied to all four backend fetch sites: the in-page API proxy, public-list route discovery,
and both `llms-full.txt` corpus fetches.

The proxy also now logs `⚠ api <status> after retries` when it gives up. Previously a 502 was passed
through to the page silently, the SPA rendered its not-found state, and that got snapshotted as the SEO
artefact — a build that looked completely successful.

Verified with a local server returning 502 twice then 200: recovers after 2 retries; a 404 is fetched
exactly once; a persistent 500 uses all 3 attempts and returns the last response rather than throwing;
a refused connection throws after 3. Then run for real against the production API — 73 pages,
43 lessons + 20 guides, no retries needed on a warm backend.

### 9.5 Still open from Sprint 1

- **Cloudflare cache rule on `/api/public/*`** — still not applied; it is Cloudflare-side config, not
  repository state, and the CF connector was unauthenticated here. The exact rule (match expression,
  edge TTL, why the path is safe to cache, how to verify) is now written up as a ~2-minute dashboard
  task in [`docs/prod/cloudflare-public-api-cache.md`](../prod/cloudflare-public-api-cache.md).

  Confirmed while writing it: the origin already sends
  `cache-control: public, s-maxage=600, stale-while-revalidate=300`, and Cloudflare answers
  `cf-cache-status: DYNAMIC` — so the header shipped by the July perf audit is currently **inert**.
  The healthcheck gate fixes the 502s; this is what fixes the 2.5–4.7s cold reads.
- **Deploy verification.** The healthcheck gate cannot be confirmed working until the next production
  deploy. Watch that deploy's HTTP log for 502s on `/api/public/lessons/*` during the rollover window —
  that is the direct before/after measurement.
