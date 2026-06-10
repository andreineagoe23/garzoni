# Billing Parity Runbook (RevenueCat-first)

This runbook keeps every billing channel aligned to the same backend plan/entitlement state.

## Canonical model

- **RevenueCat is the single source of truth for purchases.** Web uses **RevenueCat Web Billing** (Stripe-backed) via `@revenuecat/purchases-js`; mobile uses App Store / Play IAP via `react-native-purchases`. Because both configure the RC SDK with the **numeric Django user PK** as the `appUserID`, a purchase on one platform is the same RC customer on the others.
- Backend source of truth: `UserProfile.subscription_plan_id` and `UserProfile.subscription_status`, driven by the RevenueCat webhook (`/api/revenuecat-webhook/`) and reconcile.
- Accepted premium plans: `plus`, `pro`.
- Entitlement API used by clients: `GET /api/entitlements/`.
- Legacy **direct Stripe checkout** (`SubscriptionCreateView` → `/api/stripe-webhook/`) is retained as a fallback (used only when `VITE_REVENUECAT_API_KEY` is unset) and for pre-existing direct-Stripe subscribers. Reconcile still checks Stripe by customer/email.

## appUserID is load-bearing (do not regress)

The RC webhook (`authentication/views_revenuecat.py`) **silently ignores** any `app_user_id` that is not all digits (anonymous / placeholder ids). So the SDK must always be configured with the numeric Django PK:

- Web: `configureRevenueCat()` throws on a non-numeric id; `isValidAppUserId()` gates the paywall (never pass `"anonymous"`).
- Mobile: `configureRevenueCatForUser(djangoPk)` + `identifyRevenueCatUser(djangoPk)` (RC `logIn` transfers any anonymous session).

A purchase bound to a non-numeric id charges the card but never activates the plan.

## RevenueCat dashboard ↔ code id alignment

These must match exactly across the RC dashboard, web (`frontend/src/services/revenueCatService.ts`), and mobile (`mobile/src/billing/subscriptionRuntime.ts`):

| Concept             | Value(s)                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Offerings           | `plus_subscriptions`, `pro_subscriptions`                                                                                                      |
| Packages            | `$rc_monthly`, `$rc_annual`                                                                                                                    |
| Entitlements        | `Garzoni Plus`, `Garzoni Pro`                                                                                                                  |
| Web Stripe products | RC Billing is **1:1 product↔price** — one Stripe product per period (Plus/Pro × monthly/annual), each attached to its package and entitlement. |

Web Stripe product ids are mapped in `authentication/revenuecat_products.py::PRODUCT_PLAN_MAP`; the webhook also resolves via the `Garzoni Plus/Pro` entitlement, so entitlement attachment is what actually grants the plan.

## Identifier mapping matrix

| Source                 | Identifier                  | Expected backend plan |
| ---------------------- | --------------------------- | --------------------- |
| Stripe price           | `STRIPE_PRICE_PLUS_MONTHLY` | `plus`                |
| Stripe price           | `STRIPE_PRICE_PLUS_YEARLY`  | `plus`                |
| Stripe price           | `STRIPE_PRICE_PRO_MONTHLY`  | `pro`                 |
| Stripe price           | `STRIPE_PRICE_PRO_YEARLY`   | `pro`                 |
| RevenueCat product     | `PRODUCT_PLAN_MAP[*]`       | `plus` or `pro`       |
| RevenueCat entitlement | `ENTITLEMENT_PLAN_MAP[*]`   | `plus` or `pro`       |

## Configuration steps per environment

1. Configure Stripe keys + prices in backend env.
2. Configure RevenueCat API key + webhook secret in backend env.
3. Confirm webhook destinations:
   - Stripe → `/api/stripe-webhook/`
   - RevenueCat → `/api/revenuecat-webhook/`
4. Restart backend and confirm no startup mapping validation errors.

## Verification flow

### RevenueCat web purchase parity

1. Buy Plus/Pro on web (RC Web Billing paywall).
2. Confirm the RevenueCat webhook hits `/api/revenuecat-webhook/` with a digit `app_user_id` and an `INITIAL_PURCHASE`/`RENEWAL` event; `handleRCSuccess` also calls `POST /api/auth/revenuecat-sync/`.
3. Verify `GET /api/entitlements/` returns:
   - `plan=plus|pro`
   - `entitled=true`
   - `status` in active lifecycle states.
4. Cross-platform check: open mobile signed in as the same user — entitlement is active there too (shared RC customer).

> Legacy direct-Stripe fallback: with `VITE_REVENUECAT_API_KEY` unset, web hits `SubscriptionCreateView`; confirm `checkout.session.completed` at `/api/stripe-webhook/` instead.

### RevenueCat mobile purchase parity

1. Complete purchase on mobile.
2. Trigger `POST /api/revenuecat-sync/` (app does this automatically).
3. Verify `GET /api/entitlements/` on web returns same plan.

### Drift repair

- Call `POST /api/subscriptions/sync/` to run deterministic reconciliation against Stripe + RevenueCat.
- Scheduled repair task: `reconcile_subscription_profiles`.

## Common failure modes

- **Test/live mismatch (Stripe)**: test key with live `price_*` or `promo_*`.
- **Unmapped RevenueCat product**: active event received but no matching plan.
- **Entitlement naming drift**: dashboard entitlement renamed without backend alias update.
- **Webhook delay**: explicit sync endpoint should still reconcile state.
