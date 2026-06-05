# Subscription capability matrix

Source of truth for plan gating. Code lives in [`backend/authentication/entitlements.py`](../backend/authentication/entitlements.py).

## Plans

| Plan               | Monthly | Yearly | Trial                |
| ------------------ | ------- | ------ | -------------------- |
| **Starter** (free) | £0      | —      | —                    |
| **Plus**           | £6.99   | £59.99 | 7 days (yearly only) |
| **Pro**            | £7.99   | £69.99 | 7 days (yearly only) |

Currency: GBP. Channels: RevenueCat everywhere — **Web Billing (Stripe-backed)** on web, RevenueCat → Apple/Google IAP on mobile.

> **Pricing parity:** web monthly prices live in the RevenueCat Web Billing products and the store-configured prices drive mobile. Keep them in sync per plan — verify each platform's monthly/annual amounts match the table above whenever you change a price in either the RC dashboard or App Store / Play Console.

## Capability matrix

| Capability                                           | Starter                 | Plus           | Pro                         |
| ---------------------------------------------------- | ----------------------- | -------------- | --------------------------- |
| Daily learning limit                                 | 3 core actions/day      | Unlimited      | Unlimited                   |
| Hints                                                | 2 lesson/quiz hints/day | Unlimited      | Unlimited                   |
| Streak repair                                        | Locked                  | 1/day          | 1/day                       |
| Downloads                                            | 1 cert/share/day        | Unlimited      | Unlimited                   |
| Analytics & insights                                 | Locked                  | Full           | Full                        |
| **AI tutor chat** (server-persisted)                 | 5 prompts/day           | 50 prompts/day | 200 prompts/day             |
| **AI tutor model**                                   | gpt-4o-mini             | gpt-4o-mini    | **gpt-4o**                  |
| **Inline AI explain wrong answer**                   | 3/day                   | Unlimited      | Unlimited                   |
| **Personalized Path 2.0** (daily re-eval)            | Locked                  | ✔              | ✔                           |
| **Weekly AI Coach Brief**                            | Locked                  | ✔              | ✔                           |
| **Voice tutor** (mobile, Whisper + TTS)              | Locked                  | Locked         | ✔                           |
| **Receipt / statement scan** (mobile, GPT-4o vision) | Locked                  | Locked         | 5/day                       |
| **AI push nudges**                                   | basic streak            | personalised   | personalised + market-aware |

## Feature flag and permission mapping

| Capability              | Feature key                                                | Backend gate                                               | Frontend gating                                      |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Daily learning limit    | `daily_limits` (`feature.limit.daily`)                     | `/api/entitlements/consume/`                               | `EntitlementMatrix` + gated calls                    |
| Hints                   | `hints` (`feature.education.hints`)                        | `/api/entitlements/consume/`                               | `EntitlementMatrix`                                  |
| Streak repair           | `streak_repair` (`feature.gamification.streak_repair`)     | `/api/entitlements/consume/`                               | `EntitlementMatrix`                                  |
| Downloads               | `downloads` (`feature.resources.downloads`)                | `/api/entitlements/consume/`                               | Rewards share CTA                                    |
| Analytics & insights    | `analytics` (`feature.analytics.access`)                   | `/api/entitlements/` response                              | `EntitlementMatrix`                                  |
| AI tutor chat           | `ai_tutor` (`feature.ai.tutor`)                            | `OpenAIService.handle()` (`check_and_consume_entitlement`) | Chatbot send action + UpsellModal                    |
| Personalized path       | `personalized_path` (`feature.learning.personalized_path`) | `/api/personalized-path/`                                  | Personalized path CTA                                |
| AI explain wrong answer | `ai_explain` (`feature.ai.explain`)                        | `/api/exercises/explain/`                                  | `MultipleChoiceExercise` (web + mobile) inline block |
| AI Coach Brief          | `ai_coach_brief` (`feature.ai.coach_brief`)                | `/api/coach-brief/` (24h cache)                            | `PersonalizedPathContent` card                       |
| AI voice tutor          | `ai_voice` (`feature.ai.voice`)                            | `/api/voice-tutor/`                                        | `mobile/app/voice-chat.tsx` (Pro gate)               |
| AI receipt scan         | `ai_scan` (`feature.ai.scan`)                              | `/api/scan/`                                               | `mobile/app/scan.tsx` (Pro gate)                     |

## Enforcement notes

- **Backend**: `authentication.entitlements` centralises `PLAN_MATRIX` (Starter/Plus/Pro), feature flags, and per-day usage counters (Redis-cached per user per day, expires at midnight UTC). Every premium AI endpoint calls `check_and_consume_entitlement(user, "<feature_key>")` before doing work; on `False` returns 402 (`reason="upgrade"`) or 429 (`reason="quota"`).
- **Frontend**: a shared entitlements query (`fetchEntitlements`) powers the Settings plan matrix, Chatbot gating, Rewards download guard, and the Pro-only mobile screens (voice tutor, receipt scan). Locked or exhausted features surface a lock icon, disablement, and an upsell modal.
- **Token budget**: independent of per-feature quotas, every AI call also decrements a daily token budget (`OPENAI_DAILY_TOKEN_BUDGET_FREE` = 50k, `OPENAI_DAILY_TOKEN_BUDGET_PREMIUM` = 500k) to bound OpenAI spend even if a plan says "unlimited".
- **Yearly trial**: 7-day **App Store intro (free trial)** on yearly Plus and yearly Pro only (configure in App Store Connect; mobile uses RevenueCat). `UserProfile.trial_end` is set from **Stripe** (web) and **RevenueCat** webhooks / `POST /api/auth/revenuecat-sync/` (iOS/Android) when `period_type` is a free trial. Trial-ending email (`send_trial_ending_reminder`) runs when `subscription_status=trialing` and `trial_end` is **2 days before** expiry (see `authentication.tasks`).

## Channel-specific behaviour

| Channel                            | Subscription source                                          | Cancellation                 | Refunds                                 |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------- | --------------------------------------- |
| Web (RevenueCat Web Billing)       | `@revenuecat/purchases-js` entitlements + RevenueCat webhook | RC Customer Center / Stripe portal | Stripe-issued, operator-controllable    |
| Web (legacy direct Stripe — fallback) | `subscription_plan_id`, Stripe webhook events            | Stripe Customer Portal       | Stripe-issued, operator-controllable    |
| iOS (RevenueCat → App Store)       | `react-native-purchases` entitlements + RevenueCat webhooks  | iOS Settings → Subscriptions | Apple-issued, operator cannot override  |
| Android (RevenueCat → Play Store)  | `react-native-purchases` entitlements + RevenueCat webhooks  | Play Store → Subscriptions   | Google-issued, operator cannot override |

## Stripe + RevenueCat parity checklist

Use this before each release and whenever billing identifiers change.

### 1) Stripe identifiers (web)

- `STRIPE_PRICE_PLUS_MONTHLY`
- `STRIPE_PRICE_PLUS_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`

All four must be present and unique per environment (dev/prod). Backend startup now validates this.

### 2) RevenueCat identifiers (mobile + RC web sync)

- Product IDs in `PRODUCT_PLAN_MAP` must map to `plus` / `pro`.
- Entitlement names in `ENTITLEMENT_PLAN_MAP` must include `plus` / `pro` coverage.
- Keep aliases for dashboard naming drift (e.g. `Garzoni Plus` and `Garzoni Educational Plus`).

### 3) Webhooks and secrets

- Stripe webhook endpoint configured to `/api/stripe-webhook/`.
- RevenueCat webhook endpoint configured to `/api/revenuecat-webhook/`.
- `REVENUECAT_WEBHOOK_SECRET` must match RevenueCat Authorization Bearer value.

### 4) Runtime parity checks

- After a Stripe web purchase, `GET /api/entitlements/` returns `plan=plus|pro`.
- After a mobile RevenueCat purchase, call `POST /api/revenuecat-sync/`, then verify `GET /api/entitlements/`.
- `POST /api/subscriptions/sync/` is a reconciliation path for web/mobile drift repair.

### 5) Mandatory env vars by channel

- Web Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*`.
- RevenueCat sync: `REVENUECAT_API_KEY` (server REST sync), `REVENUECAT_WEBHOOK_SECRET` (webhook auth).
