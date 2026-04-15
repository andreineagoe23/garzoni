# Mobile user-testing QA checklist

Run on **iOS** and **Android** (device or simulator) against a known backend (staging or local with `EXPO_PUBLIC_BACKEND_URL`).

## Pre-flight (build)

- [ ] `pnpm run qa:mobile` passes locally (TypeScript + ESLint + core unit tests).
- [ ] Env set: `EXPO_PUBLIC_BACKEND_URL`, optional `EXPO_PUBLIC_WEB_APP_URL` (legal WebView, generic tools), RevenueCat keys if testing IAP.
- [ ] Build profile matches test (e.g. EAS `development` / internal distribution).

## Auth & onboarding

- [ ] Register, login, logout; session survives app restart.
- [ ] Forgot password / reset link opens (if testing email).
- [ ] Onboarding questionnaire: complete, abandon, resume; gating to tabs works.

## Dashboard & Learn (split is OK)

- [ ] Dashboard tab loads; weak skill tap → **Exercises** with `skill` intent and banner copy.
- [ ] Quick practice card → exercises with correct intent reason (subtitle).
- [ ] Learn tab: path/course/lesson flow; quiz if applicable.

## Exercises (parity-sensitive)

- [ ] Open exercises without params: list loads; category/type filters work.
- [ ] From dashboard weak skill: category resolves (e.g. “investing” → **Investing**), banner shows; dismiss / clear / change category behave.
- [ ] Unmapped skill: banner explains; all categories listed; no crash.
- [ ] Mapped category with **zero** exercises: empty state with clear / pick category / go to Learn.
- [ ] Review mode: start, complete, exit; refetch after reconnect.

## Tools

- [ ] Tools hub shows “web-only tools” notice; each native tool opens.
- [ ] Generic web tool route (if used): `EXPO_PUBLIC_WEB_APP_URL` set or graceful error.

## Missions & engagement

- [ ] Missions load; offline banner appears; after reconnect, missions/reviews refresh (no stale blocker).

## Profile, settings, billing

- [ ] Profile: avatar, hearts, push toggle (if applicable).
- [ ] Settings: dark mode, language, **email reminder cadence** (none/weekly/monthly), **email preference toggles**, sound/animations persist after reload.
- [ ] Subscriptions: plans load; RevenueCat path or Stripe `Linking.openURL` as configured.
- [ ] **Payment success:** open `garzoni://payment-success?session_id=test` (or real session id) → progress steps → redirect to personalized path (adjust scheme to your `app.json`).

## Support & legal

- [ ] Support / feedback forms submit.
- [ ] Legal pages load in WebView when `EXPO_PUBLIC_WEB_APP_URL` is set.

## Global UX

- [ ] API errors show **Toast** (not blocking alerts) for typical failures.
- [ ] No red-screen on tab switch; `TabErrorBoundary` catches if triggered.

## Exit criteria for first external cohort

- No blocker bugs in: auth, onboarding, exercises (skill intent), subscriptions, settings persistence.
- Visual consistency with glass + tokens on core tabs (dashboard, learn, exercises, tools, settings).
- Documented intentional gaps (e.g. web-only tools) are user-visible, not silent failures.
