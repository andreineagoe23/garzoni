# Security + latency audit (2026-08-19)

Scope: access control, security hardening, and latency across `backend/`, `frontend/`, `mobile/`,
`packages/`, plus the live Cloudflare / Vercel / Railway topology. Mobile weighted above web.

Every claim is backed by a `file:line` or a live measurement taken on 2026-08-19. Where something
could not be proven it is marked **unverified** rather than asserted. The ordering is by real
exploitability and real user-facing milliseconds — not by severity label.

Companion docs: [`platform-audit-2026-08.md`](./platform-audit-2026-08.md) (Sprints 1–2, closed),
`.claude/context/debt-register.md`.

---

## 0. Verdict first

**The question asked was "can anything be reached that shouldn't be?" The answer is: almost
nothing, and the two things that could be were exposure, not compromise.**

- **No IDOR anywhere.** Every id-taking detail route across `budgeting`, `authentication`,
  `gamification`, `support`, `finance`, and `education` scopes its lookup to `request.user`,
  enforces an explicit participant check, or is intentionally public catalog content. This was
  traced route by route, not grepped. Full table in §3.
- **The Cloudflare cache cannot serve one user's data to another.** Proven three independent
  ways (§1). This was the highest-stakes question and it comes back clean.
- **Every webhook fails closed** when its secret is unset — Stripe, RevenueCat, Customer.io, and
  the budgeting provider. The fail-open bug that was hunted for is not there (§4).
- **Staff-only education writes held.** The past hardening is still enforced on all five catalog
  viewsets plus the three custom Lesson actions (§3).

What was actually wrong, in order:

1. **The full API map was public.** `/api/schema/` served a 157 KB OpenAPI document — every
   endpoint, parameter, and auth requirement — to anonymous callers at ~690 ms a request. Fixed.
2. **The public API had a second representation.** DRF's browsable renderer answered
   `Accept: text/html` with 38 KB of HTML *and* a `Set-Cookie`, on the exact prefix Cloudflare
   caches. Not exploitable today, but only by accident (§1.3). Fixed.
3. **`www.garzoni.app/api/*` is an infinite redirect loop** — 50 hops, 3.5 s, never resolves.
   Live in production. Fixed.
4. **Mobile shipped axios 1.14.0** with 11 high advisories including prototype-pollution request
   hijacking. Fixed.
5. **The origin is directly reachable**, so every Cloudflare-layer control is advisory. Documented,
   not changed — it needs a sequencing decision (§7).

---

## 1. The Cloudflare-cached public API — the headline question

Zone `garzoni.app`, ruleset `33bf9a4e…`, rule `fe811b06…`, read live:

```
expression: (starts_with(http.request.uri.path, "/api/public/"))
action:     set_cache_settings
            cache: true            <- forces cache eligibility
            edge_ttl:    respect_origin
            browser_ttl: respect_origin
cache key:  default (no custom key configured)
```

### 1.1 The prefix contains exactly four endpoints, and none of them can vary by user

`education/urls.py:52-55` is the only registrant of the `public/` prefix. There is no catch-all or
greedy pattern that could shadow it — the only `re_path` entries in the tree are `^media/…` and the
SPA fallback (`settings/urls.py:78,85,117`).

| Endpoint | View | Varies by identity? |
| --- | --- | --- |
| `/api/public/lessons/` | `education/views_public.py:98` | **No.** `filter(is_public=True)` at `:106`. No `request.user`. |
| `/api/public/lessons/<slug>/` | `education/views_public.py:36` | **No.** `get(slug=…, is_public=True)` at `:41`. |
| `/api/public/articles/` | `education/views_public.py:163` | **No.** `filter(is_published=True)` at `:165`. |
| `/api/public/articles/<slug>/` | `education/views_public.py:175` | **No.** `get(slug=…, is_published=True)` at `:179`. |

The only use of `request` in any of them is `request.build_absolute_uri(image.url)`
(`:49`, `:115`, `:186`).

### 1.2 Proven three ways

1. **Code** — none of the four reads `request.user`, `request.session`, a cookie, or an
   identity-bearing header. Now pinned by a test that issues a real JWT and asserts the body is
   byte-identical to the anonymous one (`backend/tests/test_public_api_surface.py`).
2. **Rule scope** — the expression matches only `/api/public/`, and only those four routes exist
   under it.
3. **Live** — the HTML variant returned `cf-cache-status: BYPASS`; a request with a different
   `Origin` returned `MISS`, never a `HIT` carrying the first origin's `Access-Control-Allow-Origin`.
   Repeated identical requests go `EXPIRED → HIT → HIT` with `age` climbing, so the cache is
   genuinely working — the negative results are not just an inert cache.

### 1.3 The latent hole that was there — content negotiation *(fixed)*

`REST_FRAMEWORK` set no `DEFAULT_RENDERER_CLASSES`, so DRF's default list applied, which includes
`BrowsableAPIRenderer`. Measured live before the fix:

```
$ curl -H 'Accept: text/html' https://api.garzoni.app/api/public/lessons/
HTTP/2 200
content-type: text/html; charset=utf-8            <- 38 KB, not the 14 KB JSON
set-cookie: csrftoken=…; Max-Age=31449600; SameSite=None; Secure
cf-cache-status: BYPASS
```

Cloudflare's default cache key excludes `Accept`, and Cloudflare does not honour `Vary: Accept`.
So a second representation of a cached URL is a cache-poisoning primitive: one attacker request
could have parked HTML under the JSON key for 600 s + 300 s stale-while-revalidate, breaking the
web SPA, the mobile app, Googlebot, and the prerenderer at once.

**It did not fire — but only because Django attaches `Set-Cookie: csrftoken` to that HTML, and
Cloudflare refuses to cache a response with `Set-Cookie`.** That is a side effect, not a control.
It would have started working the day Django stopped setting that cookie, or the day someone
enabled "ignore Set-Cookie" on the rule.

Classification: **latent, one condition away from exploitable.** Fixed by removing the renderer.

### 1.4 What is safe to cache next

`/sitemap.xml` sets `public, max-age=3600` (`education/views_public.py:275`) and `@cache_page(60*60)`
(`:217`), but measures `cf-cache-status: DYNAMIC` — the rule only covers `/api/public/`, so the
sitemap is uncached at the edge. It is identity-independent and safe to add. Phase 2.

---

## 2. Findings — exploitable now

### 2.1 The complete API map was served to anonymous callers *(fixed)*

`/api/schema/`, `/api/docs/`, `/api/redoc/` were all `200` to an unauthenticated caller.
drf-spectacular defaults `SERVE_PERMISSIONS` to `AllowAny` and none was set
(`settings/settings.py:387-395` before the fix).

```
/api/schema/   200   157,101 bytes    avg 686 ms, max 770 ms (Railway http logs)
/api/docs/     200     5,582 bytes
/api/redoc/    200     1,665 bytes
```

This is not a data breach — it is reconnaissance. It hands an attacker every route, every
parameter name, every auth requirement, and every enum, including endpoints an attacker would
otherwise have to guess. It was also the slowest endpoint measured anywhere in production.

**Fixed:** `SERVE_PERMISSIONS` is now `IsAdminUser` in every environment, with `SERVE_AUTHENTICATION`
adding `SessionAuthentication` so a staff member with an admin cookie can still read it (the
project-wide default authenticator is JWT-only, which would otherwise have 403'd every real admin).
`API_DOCS_PUBLIC=true` reopens it deliberately.

Nothing depends on the endpoint — no CI job, script, or client codegen references it.

### 2.2 `www.garzoni.app/api/*` is an infinite redirect loop *(fixed)*

Measured:

```
$ curl -L https://www.garzoni.app/api/public/lessons/
curl: (47) Maximum (50) redirects followed     num_redirects=50  total=3.51s
```

Vercel 308-redirects the trailing slash off (`/api/public/lessons/` → `/api/public/lessons`),
Django's `APPEND_SLASH` 301-redirects it back, forever. Visible in the Railway http logs as 51
requests to `/api/public/lessons` returning 301 against 38 to the slashed form.

The SPA does not hit this today only because `VITE_BACKEND_URL` is baked to the Railway origin —
confirmed by grepping the deployed bundle, which contains
`https://garzoni-production.up.railway.app` and no `api.garzoni.app`. So the rewrites were both
**dead and broken**, and any crawler that found such a URL looped.

The trap underneath: `inferBackendUrl()` falls back to `${origin}/api` when the env var is missing
(`packages/core/src/services/backendUrl.ts`). One lost Vercel env var would have silently routed
the entire web app into the loop.

**Fixed:** dead rewrites removed from `vercel.json`; the fallback now emits a loud, specific
`console.error` instead of failing silently.

### 2.3 Mobile shipped axios 1.14.0 *(fixed)*

`mobile/package.json:55` and `packages/core/package.json:29` both declared `^1.7.9`, resolving to
**1.14.0**. `frontend/package.json:20` declared `^1.16.0` and resolved to 1.18.1 — so the web was
patched and mobile was not.

11 high advisories applied, including prototype-pollution gadgets allowing credential injection,
request hijacking, and full MITM via `config.proxy`, plus `Proxy-Authorization` leakage across
HTTP→HTTPS redirects. Practical exploitation in React Native needs an attacker-influenced object
merged into axios config, so this is **shipped-but-hard-to-reach** rather than trivially
exploitable — but it is a one-line fix on the only vulnerable dependency that reaches users.

**Fixed:** both bumped to `^1.18.1`. `pnpm audit` 111 → 82 findings, zero axios. Every remaining
advisory (including all 3 criticals — `vitest`, `tar` via Expo CLI, `shell-quote` via
react-devtools) is dev/build toolchain that never ships.

---

## 3. Findings — access control (all negative, evidenced)

### 3.1 IDOR: none

Every detail route was traced to its lookup expression. Representative proof:

| Concern | Lookup | Verdict |
| --- | --- | --- |
| User B's statements | `StatementImport.objects.filter(user=self.request.user)` — `budgeting/views_statements.py:332` | scoped |
| User B's transactions | `Transaction.objects.filter(user=self.request.user)` — `budgeting/views.py:121` | scoped |
| User B's linked accounts | `LinkedAccount.objects.filter(user=self.request.user)` — `budgeting/views.py:106` | scoped |
| Accepting B's friend request | `FriendRequest.objects.get(id=pk, receiver=request.user)` — `authentication/views_friends.py:83` | scoped |
| Acting on a duel you're not in | `filter(Q(challenger=viewer)\|Q(opponent=viewer))` — `gamification/views_duels.py:26-31`, plus `duel.opponent_id != user.id` guard — `gamification/services/duels.py:117` | scoped + explicit check |
| Reading B's conversation | `Conversation.objects.filter(user=self.user, source=source)` — `support/services/openai.py:103` | scoped; no id-taking route exists at all |
| B's portfolio | `PortfolioEntry.objects.filter(user=self.request.user)` — `finance/views.py:3879` | scoped |
| B's Stripe session | explicit `if str(request.user.id) != str(target_user_id): 403` — `finance/views.py:2463-2472` | explicit check |

Body-supplied FKs were checked too: no serializer exposes a `PrimaryKeyRelatedField` onto another
user's row. The id-bearing bodies that do exist (`mission_id`, `reward_id`, `lesson_id`) resolve
**global catalog rows**, and the per-user row created afterwards is always scoped to `request.user`.

### 3.2 Staff-only education writes: held

`IsStaffOrSuperuser` (`education/permissions.py:4-14`) is enforced on create/update/partial_update/
destroy for `PathViewSet` (`:209-215`), `CourseViewSet` (`:269-273`), `LessonViewSet` (`:325-341`,
including `add_section`/`update_section`/`reorder_sections`), `QuizViewSet` (`:576-582`), and
`ExerciseViewSet` (`:2044-2049`). Verified by reading each `get_permissions()`, not by absence of a
grep hit.

### 3.3 The unauthenticated surface: 30 endpoints, all intentional

`DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated` (`settings/settings.py:352`), so nothing is
accidentally public — all 30 are explicit opt-outs. They are the expected set: auth/OAuth entry
points, password reset, the four public content reads, webhooks, plan catalog, contact/support, and
the funnel ingest. No `@csrf_exempt` exists anywhere in the tree.

Two deserve naming because they authenticate by a URL-borne signed token rather than a header —
`EmailUnsubscribeView` (`authentication/views_password.py:262`) and `EmailPreferencesView` (`:367`).
That is the correct pattern for one-click unsubscribe links, but it does mean the token is in
browser history and any `Referer`. Not a finding; worth knowing.

### 3.4 Admin surface

`/admin/` returns 302 to login (not open). `/ckeditor5/` returns 404. Both are reachable on the
origin as well as through Cloudflare — see §7.

---

## 4. Webhooks — all fail closed

| Webhook | Verification | Secret unset → |
| --- | --- | --- |
| Stripe | `stripe.Webhook.construct_event` — `finance/views.py:1983` | **500, rejected** — `finance/views.py:1977-1980` |
| RevenueCat | `hmac.compare_digest` over SHA-256 — `authentication/views_revenuecat.py:69-73` | **rejected in prod** — `:52-57`. Accepts only when `settings.DEBUG` (`:58-63`), which is guarded by a boot-time `ImproperlyConfigured` in production. |
| Customer.io | HMAC-SHA256, three accepted wire formats — `notifications/views.py:97-120` | **rejected** — `if not secret … return False` at `:108-109` |
| Budgeting provider | delegates to the provider — `budgeting/views.py:306-307` | **rejected** — base class `return False`, `budgeting/services/providers.py:80-82` |

The RevenueCat DEBUG branch is the only conditional accept, and it cannot be reached in production.
This is the correct posture throughout.

---

## 5. Rate limiting

13 throttle scopes exist. Four (`ai_tutor`, `contact`, `finance_external`, `hearts_practice`)
are not in `DEFAULT_THROTTLE_RATES` but each overrides `get_rate()` with its own default, so none
raises `ImproperlyConfigured` — cosmetic inconsistency, not a gap.

The four `/api/public/*` views are the only fully throttle-exempt views in the codebase
(`throttle_classes = []`, `education/views_public.py:35,97,162,174`). That is **correct and should
stay**: they are identity-independent, edge-cached, and crawled in bursts. The edge absorbs the load.

**The expensive AI endpoints are protected, contrary to expectation.** `VoiceTutorView`
(`support/views_voice.py:27`) and `ReceiptScanView` (`support/views_scan.py:34`) carry no
`throttle_classes`, but both call `check_and_consume_entitlement` as their first statement
(`views_voice.py:44`, `views_scan.py:49`), which is a real per-day quota counter
(`authentication/entitlements.py:529-563`) returning 402/429 when exhausted. OpenAI spend is
additionally capped by per-plan daily token budgets (`support/services/openai.py:346`).

Residual, low: both accept a 20–25 MB multipart upload *before* the quota check rejects it, and the
only ceiling is the global `user: 500/day`. That is a bandwidth nuisance, not a cost exposure.
Phase 2.

---

## 6. Latency

### 6.1 Mobile — the boot chain is the win

Nothing blocks first paint on a network call; fonts and a synchronous bootstrap gate it
(`mobile/app/_layout.tsx:257-296`). The cost is in what happens immediately after.

| # | Finding | Where | Cost |
| --- | --- | --- | --- |
| 1 | **Serial waterfall on every authenticated cold start.** `fetchQuestionnaireProgress()` is awaited, and only then is `fetchProfile()` awaited. Nothing in the second depends on the first. | `mobile/app/index.tsx:104,123` | up to one extra RTT; both carry an 8 s timeout budget |
| 2 | **Both calls are then made again.** `index.tsx` uses raw uncached `apiClient.get`, then the dashboard refetches the same two endpoints via `useQuery` — and the questionnaire one sets `staleTime: 0, refetchOnMount: true`, so it *always* refetches. | `mobile/app/(tabs)/index.tsx:187-192, 204-210` | 2 redundant round trips per open |
| 3 | **Dashboard second-stage waterfall.** Five queries gated behind `progressQuery.isSuccess && profileQuery.isSuccess` though none consume those bodies. Two other queries on the same screen are not gated — the gating is inconsistent, not principled. | `mobile/app/(tabs)/index.tsx:194-195, 212-276` | a whole second RTT stage |
| 4 | **Paywall serializes RevenueCat behind the profile call.** `if (accessToken && !profileQ.isFetched) return;` before `loadOfferings()`. A JWT-derived id fallback already exists and could start RC immediately. | `mobile/app/subscriptions.tsx:1023-1029, 993-994` | Django RTT + RC RTT, serial, on the conversion screen |
| 5 | **Lesson deep-link double waterfall.** Push/share opens must resolve the lesson before `courseId` is known, then fetch lessons + flow state. In-app navigation passes `courseId` and skips it. | `mobile/app/lesson/[id].tsx:25-39` | 2 sequential RTTs before content paints |
| 6 | `flow/[id].tsx` gates the flow queries on a metadata fetch used only for the header title, though `courseId` is already in the route params. | `mobile/app/flow/[id].tsx:27-32, 48-60, 74-76` | 1 avoidable RTT |

Mitigating and worth preserving: `PersistQueryClientProvider` paints from the last-known cache
without blocking (`_layout.tsx:298-321`), and all SDK inits are fire-and-forget. Bundle hygiene is
good — no lodash, moment, or date-fns; `expo-image` in 22 files vs plain `Image` in 2; every
`FlatList` has a `keyExtractor`.

### 6.2 Web — the routing is the story

The SPA talks **directly to `garzoni-production.up.railway.app`**, bypassing Cloudflare entirely.
Consequences: `/api/public/*` is never edge-cached for web (only mobile, which correctly uses
`api.garzoni.app/api` per `mobile/eas.json`), and every authenticated call is cross-origin, so it
pays a CORS preflight. Measured: `api.garzoni.app/api/plans/` resolves in **0.19 s** with zero
redirects, against the 3.5 s / 50-hop loop through `www`.

### 6.3 Backend — no evidence of a query problem

Production http logs over the sampled window show only public content traffic, health, sitemap, and
schema. `/api/public/lessons/` averages 55 ms (max 800 ms, a cold start); `/api/schema/` was the
worst endpoint at 686 ms and is now closed. Index coverage on the user-owned hot tables is good —
`budgeting/models.py:59-60,102,191-194,285-286`, `gamification/models.py:284-286,355-356`,
`education/models.py:245-246,338-340` all carry composite `(user, …)` indexes.

**Unverified:** no authenticated traffic appeared in the sampled log window, so authed-path query
performance could not be measured. Claiming the authed paths are fast would not be honest.

---

## 7. Origin exposure — documented, not changed

`garzoni-production.up.railway.app` is publicly reachable and serves the full API:

```
GET https://garzoni-production.up.railway.app/api/public/lessons/  -> 200, real JSON
GET https://garzoni-production.up.railway.app/api/schema/          -> 200 (before the fix)
GET https://garzoni-production.up.railway.app/admin/               -> 302
```

Every Cloudflare-layer control — the cache rule, WAF, bot management, edge rate limiting — is
therefore advisory: an attacker addresses the origin and skips all of it. `ALLOWED_HOSTS` admits
the hostname deliberately (`settings/settings.py:144-152`).

**Not changed, by decision.** The sequencing matters: the deployed web bundle points *at* that
hostname, so locking the origin down breaks the web app unless the routing question (§8, Phase 2)
lands first. Options are written up in Phase 2.

Related, and the reason host-header poisoning is *not* a finding: `USE_X_FORWARDED_HOST = True`
(`settings/settings.py:557`) makes `request.get_host()` read attacker-controlled
`X-Forwarded-Host`, and the four cached views feed that into `build_absolute_uri`. Django's
`ALLOWED_HOSTS` validation rejects unknown hosts with a 400, and production forbids `"*"`
(`:138-140`), so the value cannot be set to an arbitrary attacker domain. The residual is that a
*different allowed* host (the Railway domain) could be injected into a cached `image_url`.
Low impact; noted in Phase 2.

---

## 8. Implementation plan

### Phase 1 — done (2026-08-19)

All shipped, all gates green: **448 backend tests pass**, 88 web tests pass, `pnpm typecheck`
clean, `black` clean.

| # | Change | Where |
| --- | --- | --- |
| 1 | `DEFAULT_RENDERER_CLASSES` pinned to JSON only, in **every** environment | `backend/settings/settings.py` |
| 2 | `SERVE_PERMISSIONS` → `IsAdminUser`, `SERVE_AUTHENTICATION` adds session auth, `API_DOCS_PUBLIC` escape hatch | `backend/settings/settings.py` |
| 3 | 9 regression tests pinning the cached-prefix invariants and the schema lockdown | `backend/tests/test_public_api_surface.py` |
| 4 | Dead + looping `/api/*` rewrites removed, with the reasoning recorded inline | `vercel.json` |
| 5 | Missing-`VITE_BACKEND_URL` fallback now fails loudly instead of silently | `packages/core/src/services/backendUrl.ts` |
| 6 | axios `^1.7.9` → `^1.18.1` | `mobile/package.json`, `packages/core/package.json` |

Two decisions worth recording, because both were deliberate:

- **The renderer and schema changes are not gated on `DEBUG`.** A security property that only holds
  in production cannot be covered by a test, and these two are worth tests. The browsable API is
  redundant with Swagger at `/api/docs/`, so nothing of value was lost in dev.
- **`Accept: text/html` now returns 406, not JSON.** That is correct HTTP — with no HTML renderer
  there is nothing to negotiate to. A test pins that real browser/crawler `Accept` headers (which
  end in `*/*;q=0.8`) still get a 200 JSON, so the SEO reads that justify the edge cache are safe.

### Phase 2 — mostly shipped (2026-08-19)

Ordered by value per unit of risk. Items 1–3 are the ones worth doing soon.

**1. Mobile cold-start waterfall — DONE except the paywall.**
   - ✅ **Boot calls no longer serial.** The local plan-cache read now happens *first*, since it
     decides whether the profile call is needed at all; the questionnaire and profile requests
     then run concurrently (`mobile/app/index.tsx`). Returning users with a cached plan still make
     exactly one request — the parallel profile call is skipped, not merely overlapped.
   - ✅ **Double fetch closed.** The boot probes now write their results into the React Query cache
     via `setQueryData`, so the dashboard and learn tab reuse them instead of re-requesting the
     same two endpoints seconds later. The cached shapes were matched to each `queryFn`'s return
     (`r.data` for profile, the raw payload for questionnaire).
   - ✅ **`staleTime: 0, refetchOnMount: true` removed** from the questionnaire query on *both* the
     dashboard and the learn tab, replaced by a shared `staleTimes.questionnaireProgress` in
     `packages/core`. Safe because `mobile/app/onboarding.tsx` already invalidates that key on the
     one event that changes it.
   - ✅ **`secondaryQueriesEnabled` gate removed** (`mobile/app/(tabs)/index.tsx`). This also fixed
     a failure cascade nobody had noticed: because the gate required `isSuccess`, a single
     transient profile error left review, missions, mastery, smart-resume and the heatmap
     permanently unfetched for the whole session, silently rendering a half-empty dashboard.
   - ✅ **`flow/[id].tsx` ungated** from the header-title metadata fetch. Safe because `title`
     already had a `Course ${id}` fallback and `key` is `courseId` rather than query state, so the
     late-arriving title does not remount the flow and lose its progress.
   - ❌ **Paywall RevenueCat serialization NOT changed** — see "deliberately not fixed" below.
   - **Still needs a before/after measurement on a real device.** The waterfalls removed here are
     visible in code and the request count is provably lower, but no millisecond claim is made:
     nothing in this pass was measured on hardware.

**2. Web routing — decide where the web app's API traffic goes.**
   Currently direct-to-origin. Moving it to same-origin `/api` behind Cloudflare would edge-cache
   public content for web, remove a CORS preflight per request, and stop publishing the origin
   hostname in the bundle. Blocked on trailing-slash handling: every client call site uses a
   trailing slash, Vercel strips it, Django re-adds it. Wants a preview deploy and a Vercel env
   change — do not do this blind.

**3. Origin lockdown** (depends on 2 landing first). Either a Railway-side allowlist of Cloudflare
   IP ranges, or a required shared-secret header that Cloudflare injects and Django enforces.
   Verify first what else addresses the origin directly: `keep-warm.yml` pings it by default
   (`HEALTH_PING_URL`), and the Stripe/RevenueCat/Customer.io webhook URLs must be checked before
   anything is blocked.

**4. Extend the edge cache to `/sitemap.xml`** — identity-independent, already sets
   `max-age=3600`, currently `DYNAMIC` (§1.4). Small, safe. **Not applied:** it is a Cloudflare
   ruleset edit, i.e. production config, and those need explicit sign-off.

**5. Throttle the multipart AI uploads — DONE.** `AIUploadRateThrottle` (scope `ai_upload`,
   default 60/hour, `AI_UPLOAD_THROTTLE_RATE`) now applies to `VoiceTutorView` and
   `ReceiptScanView`. Bandwidth only — entitlement quotas already protected the OpenAI spend (§5).

**6. Stop feeding `X-Forwarded-Host` into cached responses — DONE.** Added
   `canonical_file_field_url()` alongside the existing `absolute_file_field_url()` in
   `core/media_url.py`, backed by a new `PUBLIC_MEDIA_ORIGIN` setting derived from `BACKEND_URL`.
   All five media call sites in `education/views_public.py` now use it, so no `/api/public/*`
   response body is built from a request header. It reuses the existing Cloudinary-aware helper
   rather than duplicating the absolute-vs-relative logic. Three tests cover it, including a
   spoofed `X-Forwarded-Host`.

   Worth recording: this was **latent, not live** — every `image_url` in production is currently
   empty, so no lesson or article has an image for the header to influence.

**7. Web CSP** — `script-src` carries `'unsafe-inline'`, which substantially defeats CSP's XSS
   value; `img-src` allows bare `https:`. Moving to nonce or hash based CSP is a real project, not a
   quick fix. Note also that the **deployed** CSP differs from the one in `vercel.json` (production
   includes Stripe, Customer.io, and Cloudflare Insights origins that the repo file does not) —
   reconcile the two before editing either. **Unverified:** which layer adds the extra directives.

### Deliberately not fixed

| Item | Why |
| --- | --- |
| Web refresh token in `sessionStorage` | Known, audit §3.5, debt #6. The access token is already memory-only and never persisted (`AuthContext.tsx:82,173-175`), which is the harder half. Moving the refresh token to an httpOnly cookie is a real auth-flow change touching login, refresh, logout, and OAuth callback — it deserves its own change, not a footnote in an audit sweep. |
| The 82 remaining `pnpm audit` findings | Every one is dev/build toolchain (eslint, puppeteer, vitest, Expo CLI, jest). None reaches a user. Fixing them means bumping build tooling for no user-facing security gain. |
| Global DRF pagination | Already investigated and rejected with reasoning in `backend/budgeting/pagination.py`; ~150 client call sites index list responses directly. Unchanged. |
| Certificate pinning / jailbreak detection on mobile | Neither exists. Both are defensible omissions for this threat model — pinning mainly raises the cost of a determined reverse-engineer while creating a real outage risk on cert rotation. Worth a deliberate decision, not a reflex. |
| The four throttle scopes missing from `DEFAULT_THROTTLE_RATES` | Each overrides `get_rate()`; behaviour is correct. Cosmetic. |
| Paywall RevenueCat serialization (`mobile/app/subscriptions.tsx:1023-1029`) | The only Phase 2 latency item skipped. It is a real extra RTT on the conversion screen, and the JWT-derived id fallback needed to fix it already exists. But this is the purchase flow, in a 2,277-line untested screen, and getting the RevenueCat `appUserID` wrong means configuring purchases against the wrong identity — the repo rule is that it must be the numeric Django PK. That is a change to make deliberately, with a device test against the RevenueCat sandbox, not as the last item of an audit sweep. |
| OTA update code signing | `EXPO_UPDATES_CODE_SIGNING_CERTIFICATE` is not set in any `eas.json` profile, so updates ship unsigned unless supplied via EAS secrets. **Unverified** whether it is set out-of-band in EAS — check before treating this as open. |

---

## 9. Things that are genuinely good (don't "fix" them)

- Access control is right by construction: `IsAuthenticated` default, per-user querysets
  everywhere, no `@csrf_exempt` anywhere, staff gates on catalog writes.
- All four webhooks fail closed, with constant-time comparison on the two that use shared secrets.
- Mobile token handling is correct: SecureStore only, never AsyncStorage
  (`mobile/src/auth/tokenStorage.ts:1-24`), with a one-time migration that moved Personal CFO
  financial figures *off* a legacy plaintext AsyncStorage key (`mobile/src/state/cfoProfile.ts:34-53`).
- The React Query persistence layer deliberately excludes sensitive query roots from the
  unencrypted AsyncStorage snapshot (`mobile/src/bootstrap/queryPersistMobile.ts:13-34`).
  Note it is a **blocklist**: a new query key holding personal data is persisted by default unless
  someone remembers to add it. Worth a lint rule eventually.
- Push deeplinks are allowlisted before navigation (`mobile/src/bootstrap/safeDeeplink.ts:1-28`) —
  `https:` only, `garzoni.app` host suffix only, protocol-relative `//` rejected, internal paths
  regex-constrained. Attacker-controlled `data.deeplink` cannot reach `router.push` unvalidated.
- `console.error` survives the production babel strip, but every call site in the tree is itself
  wrapped in `if (__DEV__)`, so nothing logs in release.
- No client secret is exposed: every `EXPO_PUBLIC_*` and `VITE_*` value is a publishable key by
  design (Sentry DSN, reCAPTCHA site key, RevenueCat public key, OAuth client IDs).

---

## Appendix — why `vercel.json` carries no inline note

The removed `/api/*` rewrites are documented here rather than as a comment key in `vercel.json`.
Vercel validates that file against its published schema and can reject unknown top-level
properties, so an explanatory key risks failing the build for the sake of a comment. If the proxy
is ever restored, the trailing-slash problem in §2.2 is the thing to solve first.
