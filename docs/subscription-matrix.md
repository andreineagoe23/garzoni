# Subscription capability matrix

Source of truth for plan gating. Code lives in [`backend/authentication/entitlements.py`](../backend/authentication/entitlements.py).

## Plans

| Plan | Monthly | Yearly | Trial |
|---|---|---|---|
| **Starter** (free) | £0 | — | — |
| **Plus** | £7.99 | £69 | 7 days (yearly only) |
| **Pro** | £11.99 | £79 | 7 days (yearly only) |

Currency: GBP. Channels: Stripe (web), RevenueCat → Apple/Google IAP (mobile).

## Capability matrix

| Capability | Starter | Plus | Pro |
|---|---|---|---|
| Daily learning limit | 3 core actions/day | Unlimited | Unlimited |
| Hints | 2 lesson/quiz hints/day | Unlimited | Unlimited |
| Streak repair | Locked | 1/day | 1/day |
| Downloads | 1 cert/share/day | Unlimited | Unlimited |
| Analytics & insights | Locked | Full | Full |
| **AI tutor chat** (server-persisted) | 5 prompts/day | 50 prompts/day | 200 prompts/day |
| **AI tutor model** | gpt-4o-mini | gpt-4o-mini | **gpt-4o** |
| **Inline AI explain wrong answer** | 3/day | Unlimited | Unlimited |
| **Personalized Path 2.0** (daily re-eval) | Locked | ✔ | ✔ |
| **Weekly AI Coach Brief** | Locked | ✔ | ✔ |
| **Voice tutor** (mobile, Whisper + TTS) | Locked | Locked | ✔ |
| **Receipt / statement scan** (mobile, GPT-4o vision) | Locked | Locked | 5/day |
| **AI push nudges** | basic streak | personalised | personalised + market-aware |

## Feature flag and permission mapping

| Capability | Feature key | Backend gate | Frontend gating |
|---|---|---|---|
| Daily learning limit | `daily_limits` (`feature.limit.daily`) | `/api/entitlements/consume/` | `EntitlementMatrix` + gated calls |
| Hints | `hints` (`feature.education.hints`) | `/api/entitlements/consume/` | `EntitlementMatrix` |
| Streak repair | `streak_repair` (`feature.gamification.streak_repair`) | `/api/entitlements/consume/` | `EntitlementMatrix` |
| Downloads | `downloads` (`feature.resources.downloads`) | `/api/entitlements/consume/` | Rewards share CTA |
| Analytics & insights | `analytics` (`feature.analytics.access`) | `/api/entitlements/` response | `EntitlementMatrix` |
| AI tutor chat | `ai_tutor` (`feature.ai.tutor`) | `OpenAIService.handle()` (`check_and_consume_entitlement`) | Chatbot send action + UpsellModal |
| Personalized path | `personalized_path` (`feature.learning.personalized_path`) | `/api/personalized-path/` | Personalized path CTA |
| AI explain wrong answer | `ai_explain` (`feature.ai.explain`) | `/api/exercises/explain/` | `MultipleChoiceExercise` (web + mobile) inline block |
| AI Coach Brief | `ai_coach_brief` (`feature.ai.coach_brief`) | `/api/coach-brief/` (24h cache) | `PersonalizedPathContent` card |
| AI voice tutor | `ai_voice` (`feature.ai.voice`) | `/api/voice-tutor/` | `mobile/app/voice-chat.tsx` (Pro gate) |
| AI receipt scan | `ai_scan` (`feature.ai.scan`) | `/api/scan/` | `mobile/app/scan.tsx` (Pro gate) |

## Enforcement notes

- **Backend**: `authentication.entitlements` centralises `PLAN_MATRIX` (Starter/Plus/Pro), feature flags, and per-day usage counters (Redis-cached per user per day, expires at midnight UTC). Every premium AI endpoint calls `check_and_consume_entitlement(user, "<feature_key>")` before doing work; on `False` returns 402 (`reason="upgrade"`) or 429 (`reason="quota"`).
- **Frontend**: a shared entitlements query (`fetchEntitlements`) powers the Settings plan matrix, Chatbot gating, Rewards download guard, and the Pro-only mobile screens (voice tutor, receipt scan). Locked or exhausted features surface a lock icon, disablement, and an upsell modal.
- **Token budget**: independent of per-feature quotas, every AI call also decrements a daily token budget (`OPENAI_DAILY_TOKEN_BUDGET_FREE` = 50k, `OPENAI_DAILY_TOKEN_BUDGET_PREMIUM` = 500k) to bound OpenAI spend even if a plan says "unlimited".
- **Yearly trial**: 7-day trial only on yearly Plus/Pro plans. `UserProfile.trial_end` is updated from Stripe webhooks; trial-ending email fires day-5.

## Channel-specific behaviour

| Channel | Subscription source | Cancellation | Refunds |
|---|---|---|---|
| Web (Stripe) | `StripePayment`, `subscription_plan_id`, webhook events | Stripe Customer Portal | Stripe-issued, operator-controllable |
| iOS (RevenueCat → App Store) | `react-native-purchases` entitlements + RevenueCat webhooks | iOS Settings → Subscriptions | Apple-issued, operator cannot override |
| Android (RevenueCat → Play Store) | `react-native-purchases` entitlements + RevenueCat webhooks | Play Store → Subscriptions | Google-issued, operator cannot override |
