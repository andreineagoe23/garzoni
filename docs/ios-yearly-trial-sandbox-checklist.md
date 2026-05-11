# iOS yearly Plus/Pro intro trial — sandbox checklist

Use this list after wiring **1-week free trial** intro offers in **App Store Connect** (yearly **Plus** and **Pro** product IDs) and matching packages in **RevenueCat**.

## App Store Connect

- [ ] Yearly product IDs match the app (e.g. `app.garzoni.mobile.plus_yearly_v3`, `app.garzoni.mobile.pro_yearly_v3`) and the RevenueCat offering packages.
- [ ] **Introductory Offer** (or free trial) is **7 days**, attached to the **yearly** subscriptions only (not monthly, unless you intentionally add one).
- [ ] Intro offer eligibility (new subscribers / existing) matches your business rules.

## RevenueCat

- [ ] Each yearly product is mapped to entitlements **Garzoni Plus** / **Garzoni Pro** as expected.
- [ ] Current / targeted offerings include the yearly packages used by the app paywall.
- [ ] **Webhook** is configured: `POST /api/auth/revenuecat-webhook/` with the same `Authorization: Bearer` secret as `REVENUECAT_WEBHOOK_SECRET` on the backend.
- [ ] **REST API key** is set as `REVENUECAT_API_KEY` for `POST /api/auth/revenuecat-sync/`.

## Device / simulator (sandbox)

- [ ] Sign in with a **Sandbox** Apple ID (Settings → App Store / Developer).
- [ ] Open the in-app **Subscriptions** / paywall screen; confirm the Pro/Plus **yearly** row shows a **1 week free trial** badge (driven by StoreKit `introPrice` when eligible).
- [ ] Complete purchase; confirm **Manage Plan** / entitlements show the correct tier after sync.
- [ ] **Backend** (optional, for one test user): after purchase, `UserProfile.subscription_status` should be **`trialing`** and **`trial_end`** set until the trial converts; after conversion, **`active`** and **`trial_end`** cleared. Easiest check: `GET /api/entitlements/` — includes `status`, `trial_end`, `entitled`.

## Regression

- [ ] **Restore purchases** still upgrades an existing subscriber.
- [ ] Monthly yearly-uneligible flows still **do not** show a trial badge if no intro is configured.
