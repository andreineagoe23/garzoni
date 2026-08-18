# API surface

Live, generated docs (always authoritative — drf-spectacular reads the real views/serializers):

- **Swagger UI**: `/api/docs/`
- **OpenAPI JSON**: `/api/schema/`
- **Redoc**: `/api/redoc/`

This file is the **map** — what exists, where it lives, and the shape rules. Use it to find the
right module; use `/api/docs/` for exact request/response schemas.

## Routing shape — read this before adding a route

Root: `backend/settings/urls.py`. Every app is included under a **flat `/api/` prefix with no
namespace**, so collisions are resolved by include order — `onboarding` is deliberately first
(`urls.py:64`). **Check for a clash before adding a path.**

Business logic belongs in `backend/<app>/services/`, not appended to a view module. `finance/views.py`
(3,973 lines) and `education/views.py` (3,416) are what happens when that rule is ignored.

## Infrastructure / meta

`/` · `/health/` (real readiness probe: DB + Redis hard-fail → 503, Celery broker warn-only —
Railway gates deploys on it) · `/robots.txt` · `/sitemap.xml` ·
`/.well-known/apple-app-site-association` · `/admin/` · `/ckeditor5/` · `/media/…`

## By domain

| Domain | Module | Routes |
| --- | --- | --- |
| **Auth** | `authentication/urls.py` | `login-secure/`, `register-secure/`, `token/refresh/`, `verify-auth/`, `logout/`, `csrf/`, `auth/google/` + `/callback`, `password-reset/` + confirm, `change-password/`, `delete-account/`, `email/unsubscribe\|preferences/`, `auth/push-token/`. Root-mounted: `api/auth/google/verify-credential/`, `api/auth/apple/verify-identity/` |
| **Profile / social** | `authentication/urls.py` | `userprofile/`, `me/profile/`, `user/settings/`, `activity-heatmap/`, `update-avatar/`, `users/<id>/public-profile/`, `users/search/`, `friends/activity-feed\|suggestions/`, `friend-requests/`, `leaderboard/friends/`, `referrals/` + `validate/` |
| **Entitlements / hearts** | `authentication/urls.py` | `entitlements/`, `entitlements/consume/`, `plans/`, `user/hearts/{,decrement,grant,refill,practice}/` |
| **Learning** | `education/urls.py` | routers `paths\|courses\|lessons\|quizzes\|userprogress\|exercises`; `exercises/progress/<id>/`, `progress-batch/`, `reset/`, `explain/`; `personalized-path/` + `refresh/`, `review-queue/`, `mastery-summary/`, `whats-next/`, `next/`, `coach-brief/`, `progress/complete/` |
| **Public (SEO)** | `education/urls.py` | `public/lessons/`, `public/lessons/<slug>/`, `public/articles/`, `public/articles/<slug>/` — consumed by the Vercel prerender; cache-sensitive |
| **Gamification** | `gamification/urls.py` | `missions/` + `<id>/update/` + `complete\|swap\|generate\|analytics`, `streak-items/`, `streak-wagers/` + `<id>/cancel/`, `leaderboard/` + `duel/` + `rank/`, `recent-activity/`, `reward-ledger/`, `weekly-recap/`, `leagues/current\|history/`, `duels/…`, routers `badges`, `user-badges` |
| **Billing** | `finance/urls.py` | `stripe-webhook/`, `verify-session/`, `subscriptions/create\|change\|sync\|cancel\|portal/`, `entitlements/`, `purchases/`, `rewards/shop\|donate/`, `funnel/events\|metrics/`. RevenueCat webhook lives in auth: `revenuecat-webhook/`, `revenuecat-sync/` |
| **Tools / market** | `finance/urls.py` | `market/search\|quotes\|quote/<ticker>/`, `stock-price/`, `forex-rate/`, `crypto-price/`, `asset-search/`, `paper-trade/buy/`, routers `portfolio` + `financial-goals`, `savings-account/`, `finance-fact/`, `calculate-savings-goal/`, `news/`, `economic-calendar/`, `next-steps/` + `<id>/complete/` |
| **Budgeting / CFO** | `budgeting/urls.py` | routers `budgeting/linked-accounts\|transactions\|envelopes\|statements`; `statements/allowance\|preview\|commit\|insight/`, `spending-summary/`, `anomalies/`, `provider-status\|provider/link-token\|provider/webhook/`, `personal-cfo/summary\|dashboard\|narrative\|progress\|coach/`. See [`budgeting-and-open-banking.md`](budgeting-and-open-banking.md) |
| **Tutor / support** | `support/urls.py` | `proxy/openai/`, `conversation/history/`, `conversation/session-debrief/`, `voice-tutor/`, `scan/`, `smart-resume/`, `support/` + `<id>/vote/`, `contact/`, `app-review-feedback/` |
| **Onboarding** | `onboarding/urls.py` | `questionnaire/progress\|next-question\|save-answer\|complete\|abandon\|cleanup/`, `onboarding/plan-summary/` |
| **Notifications** | `notifications/urls.py` | `notifications/cio-ping\|cio-webhook\|client-track/` |

## Compat aliases — do not add more

Duplicate paths kept for old clients: `finance/entitlements/` and `finance/news/`
(`finance/urls.py:57,63`) · `auth/email/*` (`authentication/urls.py:100-112`) ·
a second `api/me/profile/` (`settings/urls.py:36`) · no-slash variants of the Google/Apple verify
routes (`settings/urls.py:47,60`). Every alias is a permanent maintenance cost and a chance for the
two paths to drift. Migrate clients instead.

## Cross-cutting rules

- **Permissions**: check them on every new viewset. Public/unauthed endpoints follow the
  `views_public.py` pattern. Education viewsets are **staff-only for writes** (a past security fix).
- **Throttling**: 12 named DRF scopes, all env-overridable
  ([`environment.md`](environment.md) §5). New expensive or unauthed endpoints should get one.
- **Pagination**: there is **no DRF default** today, and at least one list (statement history) is
  unbounded — `docs/audit/platform-audit-2026-08.md` §2.2. Paginate new list endpoints explicitly.
- **OpenAI calls need an explicit timeout.** No exceptions.
- **Never a bare `except:`** — log it. Silent excepts have cost real production debugging time here.
- Cache and entitlement counters live in Redis; assume Redis may be cold.

## Keeping the generated docs honest

`drf-spectacular` reads your views and serializers, so:

- give serializers real field types and choices
- add view docstrings where the intent isn't obvious from the name
- after changing an endpoint, load `/api/docs/` and confirm the schema matches
- update the table above when you add a domain or a new route group
