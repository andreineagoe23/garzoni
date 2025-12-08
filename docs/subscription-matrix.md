# Subscription capability matrix

## Plan comparison

| Capability | Free | Premium |
| --- | --- | --- |
| Daily learning limit | 3 core actions/day | Unlimited |
| Hints | 2 lesson/quiz hints/day | Unlimited |
| Streak repair | Locked | 1 repair/day |
| Downloads | 1 certificate/share download/day | Unlimited |
| Analytics & insights | Locked | Full access |
| AI tutor quota | 5 prompts/day | 50 prompts/day |

## Feature flag and permission mapping

| Capability | Feature flag | Backend check | Frontend gating |
| --- | --- | --- | --- |
| Daily learning limit | `feature.limit.daily` | `/api/entitlements/consume/` | `EntitlementMatrix` + gated calls |
| Hints | `feature.education.hints` | `/api/entitlements/consume/` | `EntitlementMatrix` copy (ready for hint UI) |
| Streak repair | `feature.gamification.streak_repair` | `/api/entitlements/consume/` | `EntitlementMatrix` copy (ready for streak UI) |
| Downloads | `feature.resources.downloads` | `/api/entitlements/consume/` | Rewards share CTA (lock/limit) |
| Analytics & insights | `feature.analytics.access` | `/api/entitlements/` response | `EntitlementMatrix` highlights lock state |
| AI tutor quota | `feature.ai.tutor` | `/api/proxy/openrouter/` + `/api/entitlements/consume/` | Chatbot send action (lock/limit + upsell) |

## Enforcement notes

- **Backend**: `authentication.entitlements` centralizes plans, feature flags, and per-day usage counters (cached per user per day). AI tutor requests are blocked/upselled server-side before reaching the OpenRouter proxy, and `entitlements/consume` ensures other premium actions are verified server-side even when triggered from the client.
- **Frontend**: a shared entitlements query powers the Settings plan matrix, Chatbot gating, and Rewards download guard. Locked or exhausted features surface a lock icon, disablement, and an upsell modal to guide upgrades.
