# Garzoni UX Psychology Plan — Onboarding & Monetization Overhaul

**Date:** 2026-07-13
**Source:** Code audit (mobile onboarding, web funnel, paywall/engagement surfaces) mapped against UX-psychology research: smart defaults, goal gradient, reciprocity, IKEA/endowment effect, loss aversion, contrast/anchoring, plus paywall-flow and onboarding-flow pattern studies (Grammarly, Blinkist, Headspace, Duolingo, Mural, House benchmarks).

**Core diagnosis:** Garzoni asks before it gives. Mobile shows the paywall before the first lesson; web quiz completion hard-redirects to the pricing page; guest content is 100% read-only. Rich personalization data (`goal_types`, `timeframe`, `risk_comfort`, full quiz answers) is stored but never used in paywall or retention copy. Streak/hearts mechanics exist but have no loss-framing teeth (hearts refill free 30×/day).

**North-star metrics:**

- Activation: % of new signups completing first lesson within 24h (`first_lesson_at` already tracked)
- Trial starts / paywall view (mobile `pricing_view` → `upgrade_click` funnel already instrumented)
- D7 retention
- Web checkout conversion (currently leaking to app stores during Summer60)

---

## Phase 1 — Value Before Ask (conversion core)

**Theme:** Make the paywall the natural end of a personalized story, fix the two worst funnel breaks, add loss-framing where the data already exists. Highest ROI, smallest surface area.
**Estimated effort:** ~2 weeks.

### 1.1 "Your Plan Is Ready" segue screen (mobile + web) — the big one

Grammarly pattern (+20% plan upgrades from quiz-tailored recommendations) + Endel/Bitepal "show what your answers unlocked" + Speak date-anchored outcome.

**Backend**

- Extend `completeQuestionnaire()` response (or add `GET /onboarding/plan-summary/`) in `backend/onboarding/` returning:
  - `stated_goals` (humanized from `UserProfile.goal_types`, `timeframe`, `risk_comfort` — `backend/authentication/models.py:93-98`)
  - `curated_lessons`: first 3 lessons of the personalized path (titles + topic icons)
  - `projected_outcome`: template string + target date computed from `timeframe` + path length ("By {month}, you'll be able to {goal-derived outcome}")
  - `recommended_tier`: `plus` | `pro`, derived from answers (e.g. investing_experience/goal count → Pro; otherwise Plus)
- New serializer only; all data already persisted in `QuestionnaireProgress.answers` and derived profile fields. No schema changes.

**Mobile** (`mobile/app/onboarding.tsx`, new `mobile/src/components/onboarding/PlanReadyScreen.tsx`)

- Insert between `OnboardingLoadingScreen` completion and the push prompt: goals as chips, 3-lesson path preview, outcome line with date, single CTA "See my plan options →".
- Keep the 5.7s loading theater (research supports it) but have it resolve into this screen instead of straight to the Alert.
- Paywall (`mobile/app/subscriptions.tsx`): in `mode=paywall`, replace generic headline "Pick the plan that moves you forward" (line 1028) with goal-referencing copy ("Unlock the path built for {goal}") and preselect + scroll to `recommended_tier`.

**Web** (`frontend/src/components/onboarding/`)

- New `PlanReadyPage` at `/plan-ready`; quiz completion routes here (see 1.2), then CTA continues to `/subscriptions` (segue) with a persistent "Continue free →" secondary link to dashboard.

**Analytics:** `plan_ready_view`, `plan_ready_continue`, `paywall_personalized_view` events; compare paywall conversion vs. pre-launch baseline.

### 1.2 Fix web quiz → pricing hard redirect

- `frontend/src/components/onboarding/OnboardingQuestionnaire.tsx`: replace all three `window.location.href = "/subscriptions"` completion paths (lines 140, 253, 303) and the `QuestionnaireCompletionModal` CTA with SPA navigation to `/plan-ready`.
- `frontend/src/components/dashboard/Dashboard.tsx:308-333`: soften the force-redirect — allow users with `in_progress` questionnaire to browse the dashboard; keep `QuestionnaireReminderBanner` as the nudge. Kills the mid-quiz redirect trap.

### 1.3 Loss-aversion pass: streaks + hearts

Kahneman: loss ≈ 2× gain. The strongest copy in the codebase (`mobile/src/streak/streakReminder.ts:50` — "keeps your {N}-day streak alive") never appears in-app.

**Frontend (shared copy in `packages/core/src/locales/en/common.json`)**

- `dashboard.statusSummary.streakAtRisk` → interpolate the number: "Don't lose your **{count}-day** streak — one short lesson today." Consumed by both `mobile/src/components/dashboard/StatusSummaryGrid.tsx:117` and `frontend/src/components/dashboard/StatusSummary.tsx`. Streak count already in the profile payload; no backend change.
- Out-of-hearts modal (`mobile/src/lesson/LessonFlowScreen.tsx:1091-1132`): add third option "Plus refills hearts 2× faster — Upgrade" → `/subscriptions?reason=hearts`. The 2× claim is already true server-side (`backend/authentication/services/hearts.py:15-16`).

**Backend**

- Nerf the free instant refill: `backend/settings/settings.py:336` rate limit 30/day → 3/day, and/or add a coin cost in `backend/authentication/views_hearts.py:88-104`. Without this the scarcity mechanic is fiction and the modal never converts.
- Guard: keep Plus/Pro refills unlimited (or generous) so the upgrade CTA has a real payoff.

### 1.4 Pricing integrity + anchoring (web)

- **Stale landing prices:** `frontend/src/components/landing/Welcome.tsx:1096-1245` hardcodes £5.00/£5.83-mo vs. real £6.99/£7.99 (`backend/authentication/entitlements.py:244-309`). Fetch `/plans/` (already public) and render live catalog. Structural fix, not a copy patch.
- **Savings anchor:** port mobile's computed `savingsPct` badge (`mobile/app/subscriptions.tsx:987-998`) to the web yearly toggle in `SubscriptionPlansPage.tsx:442-471`.
- **Per-week contrast framing:** under yearly price on both platforms: "That's £1.15/week — less than one coffee." Pure display math.
- **Paywall micro-wins (mobile + web):** "No commitment — cancel anytime" subtitle under CTA; chevron `›` on the CTA button.

### 1.5 Summer60 web leak (time-sensitive — promo live until 08-31)

Today a promo-priced card on web opens the App/Play Store (`SubscriptionPlansPage.tsx:587-604`) — paid web traffic bounces off-site.

- **Preferred:** configure RC Web Billing intro offers for Plus/Pro yearly (RevenueCat dashboard — pairs with the existing manual store-offers task in `docs/promo/`), then let the promo card check out natively via the existing `RevenueCatPaywall` path.
- **Fallback (same-day ship):** dual CTA on promo cards — "Get 60% off in the app" (store link) _and_ "Continue on web at full price", so web checkout is never dead-ended.

### 1.6 Exit-intent on paywall skip

- Mobile: "Skip for now" (subscriptions.tsx:1108-1122) → bottom sheet before dismiss: "Not ready for a year? Try monthly." (+ Summer60 one-time-offer framing while live). Decline → home as today.
- Web: same sheet on `RevenueCatPaywall` dismiss.
- Analytics: `exit_intent_shown` / `exit_intent_accepted`.

**Phase 1 exit criteria:** plan-ready screen live both platforms; zero completion paths landing on bare pricing; hearts refill nerfed + upgrade CTA present; landing prices live-fetched; no dead-end web promo checkout.

---

## Phase 2 — Friction & Momentum (activation)

**Theme:** cut signup friction, never start users at zero, make first-session wins felt.
**Estimated effort:** ~2-3 weeks. Depends on Phase 1 analytics events for measurement.

### 2.1 Multi-step registration (mobile + web)

House benchmark: splitting the form = +15% conversion. Current: 6 fields + 2 checkboxes on one screen, both platforms.

**Backend** (`backend/authentication/` registration serializer)

- Accept email + password + consents only. Auto-generate `username` from email local-part (dedupe suffix); make `first_name`/`last_name` optional, collected later in profile or questionnaire.
- Keep the consent contract (`accept_terms`, `age_confirmed`) — required by existing social-login flow too.

**Mobile** (`mobile/app/(auth)/register.tsx`)

- Step 1: email + password + inline consent checkboxes. Step 2 (optional, skippable): name. Progress dots.
- Login: accept email _or_ username (backend: auth backend already keyed on username — add email lookup fallback).

**Web** (`frontend/src/components/auth/Register.tsx`)

- Same two-step split. **Unblock Google OAuth:** move to tap-to-consent like mobile (consent captured in OAuth `next` payload) instead of gating the Google button behind checkboxes (lines 483-493). Keep `referral_code` as a collapsed "Have an invite code?" link.

### 2.2 Goal gradient: never start at 0%

- **Backend:** seed questionnaire `progress_percentage` so Q1 renders ≥15% — account creation counts as step 1 (car-wash study: endowed progress ≈ 2× completion). One change in the questionnaire progress calculator in `backend/onboarding/`.
- **Web quiz header:** "Step 2 of 7" framing (account = step 1) in `OnboardingQuestionnaire.tsx:592-607`.
- **Verify goal question is `multiple_choice` multi-select** (Headspace: +10% trial conversion from multi-goal). Content/config change in the questionnaire definition; renderers already support it on both platforms.

### 2.3 Custom push pre-permission screen (mobile)

Replace the native Alert (`mobile/app/onboarding.tsx:299-322`) with a full screen that _previews the actual notification_: mock push card "🔥 Your 5-day streak needs one lesson" + "Remind me" / "Not now". OS prompt only fires after "Remind me" (logic in `pushNotificationsMobile.ts:161-170` unchanged). Center-app pattern; also feeds trial-reminder trust (2.4).

### 2.4 Trial timeline on paywall (Blinkist pattern)

Component on both paywalls when a trial exists (RC `introPrice === 0` mobile; `trial_days` web):

- **Today** — full access unlocked · **Day 5** — reminder before charge · **Day 7** — subscription starts.
- Backend: add a `trial-ending` CIO event 2 days pre-expiry (Celery beat sweep on `entitlements.trialEnd`, same shape as `emit_streak_about_to_expire` in `backend/education/tasks.py:102-141`) so the Day-5 promise is real.

### 2.5 Web first-run checklist (Mural: +10% 1-week retention)

- `frontend/src/components/dashboard/FirstWeekChecklist.tsx`, rendered above `StatusSummary` for users < 7 days old: ✓ Built your plan (pre-checked — endowed progress) · Complete first lesson · Try one AI tool · Start your streak.
- Derive state client-side from existing summary payload (`first_lesson_at`, tool usage, streak); backend only needs to expose `first_lesson_at` + a tool-used flag in the dashboard summary serializer (`backend/education/views.py` summary payload).
- Dismissible but persistent until complete.

### 2.6 First-lesson-ever celebration

- `first_lesson_at` (`backend/authentication/models.py:126-127`) is tracked and unused. When a completion sets it: backend returns `is_first_lesson: true` + a one-time bonus XP grant (`RewardLedgerEntry`); mobile `LessonFlowScreen.tsx:713-808` and the web flow render a distinct moment — bigger confetti, "Day 1 🔥 — your streak starts now", plan-progress tick, checklist item auto-completes.

### 2.7 Cut the redundant intro

Remove `OnboardingIntroPager` (4 slides duplicating the welcome carousel's messaging) from `mobile/app/onboarding.tsx` — straight from auth into the quiz. Keeps total flow length but every remaining screen builds investment.

**Phase 2 exit criteria:** 2-step signup live; Google OAuth one-tap on web; quiz never shows 0%; custom push screen replaces Alert (measure accept-rate delta); checklist live; first-lesson moment shipped.

---

## Phase 3 — Big Bets (growth & retention)

**Theme:** give value pre-signup, surface the best asset (The Climb), extend goal gradients for retained users. Larger builds; sequence after Phases 1-2 land and baselines settle.
**Estimated effort:** ~4-6 weeks, parallelizable.

### 3.1 Guest taste — reciprocity before signup

**Web (do first — cheaper, feeds SEO pages already ranking):**

- Backend: `GET /public/lessons/{slug}/sample-question/` in `backend/education/views_public.py` — one whitelisted question per public lesson, `AllowAny`, options shuffled, correct answer included in payload _only for client-side checking_ on explicitly whitelisted sample questions (never from the real quiz pool; extend the `is_public` opt-in pattern with a `sample_question` FK per lesson).
- Frontend: embed in `PublicLesson.tsx` after the prose. Answer → instant feedback + "You'd have earned 10 XP — create a free account to keep it." Converts 43 read-only SEO pages into product demos.

**Mobile:**

- Bundled local demo lesson (no network, no guest accounts): "Try a lesson" button on the welcome carousel opens a 5-question hardcoded starter lesson; completion screen → register with "Save your progress" framing (Duolingo pattern — invested users don't abandon at signup). Avoids the full guest-auth backend build.

### 3.2 The Climb → front and center + web port

- Mobile: journey summary card on Home (`mobile/app/(tabs)/index.tsx`) — mini trail, current node, "{percent}% climbed" → deep-links to Learn journey mode. Fog-locked upgrade nodes (`JourneyMapContent.tsx:808-815`) are a ready-made endowment paywall surface — route locked-node taps to `/subscriptions?reason=journey`.
- Web port: reuse `journeyLayout.ts` math (pure TS — move to `packages/core`), rebuild rendering in React/SVG for `frontend/src/components/dashboard/PersonalizedPathContent.tsx`. Closes the biggest visual-delight gap between platforms (web first-run is currently an all-zero stat grid).

### 3.3 Profile completeness meter

- Backend: `profile_completeness` (0-100) in the profile serializer — avatar, name, goals set, notification prefs, first lesson, first tool. Weighted so a fresh post-quiz user starts ~40%, never 0 (endowed progress + endowment).
- Frontend: ring on Profile screens (both platforms) + "Complete your profile" row with the next missing item.

### 3.4 Prestige tiers past 2500 XP

- Goal gradient currently dies at "max tier" (`packages/core/src/utils/userLevel.ts:1-7`, `XPProgressCard.tsx:55-58`) — for exactly the users who pay. Extend to open-ended prestige levels (Advanced I/II/III…, +2500 XP each) with badge grants via the existing `evaluate_badges_for_user()` pipeline (`backend/gamification/utils.py`).

### 3.5 Paywall placement experiment: after first lesson

- Don't move it blind — A/B it. Feature flag: control = current post-quiz paywall (with Phase 1 plan-ready segue); variant = plan-ready → straight to first lesson → paywall after first-lesson celebration ("Keep your streak and your plan — unlock everything").
- Infra exists: RevenueCat experiments + `pricing_view`/`upgrade_click`/`checkout_completed` funnel events (analytics audit 2026-07). Primary metric: trial starts per signup; guardrail: D1 activation rate. This resolves the "paywall-after-first-lesson" open question from the analytics audit with data.

### 3.6 Empty-state upgrade pass (small, batched)

Replace flat strings in `packages/core/src/locales/en/common.json` (leaderboard 1552, badges 1595, activity 1600/1966): each empty state gets a CTA + next-step hint ("Complete a lesson to enter this week's leaderboard", badge cards show "2 lessons to unlock"). Wire web's existing `EmptyState.tsx` component beyond its single current usage.

**Phase 3 exit criteria:** web sample questions live on public lessons; demo lesson in mobile welcome; Climb card on Home + web journey view; completeness meter live; paywall-placement experiment running with ≥2 weeks of data.

---

## Explicitly rejected

- **Fake progress inflation** — counting account creation as a real step is honest reframing; seeding fictional % is not.
- **Spin-the-wheel / countdown discount theatrics** — trust erosion + Apple's early-2026 crackdown on misleading paywall patterns.
- **Removing the 5.7s "building your path" animation** — pattern data supports value-building loading states; keep it, land it on the plan-ready screen.
- **Shortening onboarding for its own sake** — average successful app has ~25 onboarding screens; length is fine when every screen builds investment. Cut only the redundant intro pager.

## Measurement plan

| Metric                             | Instrument                                                      | Phase |
| ---------------------------------- | --------------------------------------------------------------- | ----- |
| Paywall conversion (view → trial)  | existing `pricing_view`/`upgrade_click` + new `plan_ready_view` | 1     |
| Web checkout completion            | `promo_app_redirect` vs. new web-checkout events                | 1     |
| Signup completion rate             | register step events (add per-step)                             | 2     |
| Push accept rate                   | pre-permission screen events vs. Alert baseline                 | 2     |
| D1 activation (first lesson < 24h) | `first_lesson_at`                                               | 2-3   |
| D7 retention                       | existing `last_seen_at`                                         | 2-3   |
| Paywall placement winner           | RC experiment                                                   | 3     |
