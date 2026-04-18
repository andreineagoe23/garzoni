# Route inventory — UI surfaces

Reachable routes from `frontend/src/App.tsx` and nested tools. Primary layout primitives: `Navbar`, `Footer`, `GlassContainer`, `GlassCard`, `GlassButton`, page-specific sections.

## Public / auth

| Path                                                                              | Key components                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/`                                                                               | Landing / redirect                                                                        |
| `/welcome`                                                                        | `Welcome`                                                                                 |
| `/login`, `/register`, `/auth/callback`, `/forgot-password`, `/reset-password`    | Auth forms                                                                                |
| `/privacy-policy`, `/cookie-policy`, `/terms-of-service`, `/financial-disclaimer` | `LegalPageWrapper` + policy pages                                                         |
| `/subscription-plans`, `/upgrade`, `/subscription`, `/payment-success` (legacy redirect) | Billing (`SubscriptionPlansPage`, `Upgrade`, `SubscriptionManager`, `PaymentSuccessPage`) |

## Authenticated (main shell: Navbar + content)

| Path                           | Key components                             |
| ------------------------------ | ------------------------------------------ |
| `/all-topics`                  | `Dashboard` / topic hub                    |
| `/personalized-path`           | Personalized path flow                     |
| `/exercises`, `/exercises/:id` | `ExercisePage`                             |
| `/missions`                    | `Missions`                                 |
| `/leaderboards`                | `Leaderboard`                              |
| `/rewards`                     | `RewardsPage`                              |
| `/support`                     | `SupportPage`                              |
| `/feedback`                    | `FeedbackHubPage`                          |
| `/profile`, `/settings`        | `Profile`, `Settings`                      |
| `/courses/...`, `/quiz/...`    | `CoursePage`, `CourseFlowPage`, `QuizPage` |
| `/onboarding`                  | `OnboardingQuestionnaire`                  |
| `/pricing-dashboard`           | `PricingFunnelDashboard` (admin nav)       |

## Tools (`/tools`, `/tools/:toolRoute`)

Registry: `frontend/src/components/tools/toolsRegistry.ts` — e.g. portfolio, reality-check, calendar, economic-map, news-market-context, market-explorer, next-steps, goals tracker, calculators, etc. (`ToolsPage` + lazy tool panels).

## Chatbot / consent

Global: `Chatbot`, `CookieConsentBanner` (paths gated in `AuthAwareLayout`).
