# Billing Parity Runbook (Stripe + RevenueCat)

This runbook keeps web Stripe billing and mobile RevenueCat billing aligned to the same backend plan/entitlement state.

## Canonical model

- Backend source of truth: `UserProfile.subscription_plan_id` and `UserProfile.subscription_status`.
- Accepted premium plans: `plus`, `pro`.
- Entitlement API used by clients: `GET /api/entitlements/`.

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

### Stripe web purchase parity

1. Buy Plus/Pro on web.
2. Confirm `checkout.session.completed` and/or `customer.subscription.updated` logs.
3. Verify `GET /api/entitlements/` returns:
   - `plan=plus|pro`
   - `entitled=true`
   - `status` in active lifecycle states.

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
