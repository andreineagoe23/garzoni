# Monevo — Outstanding Tasks

Two workstreams: **iOS App Store launch** and **RevenueCat Web SDK**.
Code changes are done; everything below requires manual configuration, accounts, or deployment.

---

## 1. iOS App Store Launch

### 1A. Apple In-App Purchase (RevenueCat mobile — code complete)

Code written: `mobile/app/billing.tsx`, `backend/authentication/views_revenuecat.py`, `mobile/src/bootstrap/httpClientMobile.ts`.

Manual steps still required:

- [ ] **App Store Connect** — create 4 subscription products:
  - `tech.monevo.app.plus_monthly`
  - `tech.monevo.app.plus_yearly`
  - `tech.monevo.app.pro_monthly`
  - `tech.monevo.app.pro_yearly`
- [ ] **RevenueCat Dashboard (mobile project)** — add the 4 products above, link to the default offering
- [ ] **RevenueCat API key (iOS)** — get the public iOS key from RC Dashboard → API Keys, add to:
  - `mobile/.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY=<key>`
  - EAS project secrets (so it's available in production cloud builds)
- [ ] **RevenueCat webhook secret** — generate a random string, then:
  - Add to `backend/.env` as `REVENUECAT_WEBHOOK_SECRET=<secret>`
  - Add the same string in RC Dashboard → Project → Integrations → Webhooks → Secret
  - Set the webhook URL to `https://monevo.tech/api/auth/revenuecat-webhook/`
- [ ] **Test purchase flow end-to-end** in Xcode simulator with StoreKit sandbox:
  - Purchase a plan → verify `UserProfile.subscription_plan_id` updates via webhook
  - Restore purchases → verify entitlement is re-applied
  - Cancellation event → verify plan reverts to `starter`

### 1B. Universal Links / Password Reset (code complete)

Code written: `backend/core/views.py` (`apple_app_site_association`), `mobile/ios/Monevo/Monevo.entitlements`, `mobile/app/password-reset/[uidb64]/[token].tsx`.

- [ ] **Apple Team ID** — find your 10-character Team ID at [developer.apple.com](https://developer.apple.com) → Membership, then add to `backend/.env`:
  ```
  APPLE_TEAM_ID=AB12CD34EF
  ```
- [ ] **Deploy backend** — the AASA file at `https://monevo.tech/.well-known/apple-app-site-association` must be reachable over HTTPS with no redirect and no auth before iOS will trust Universal Links
- [ ] **Verify AASA** — after deploying, confirm the file returns valid JSON:
  ```
  curl https://monevo.tech/.well-known/apple-app-site-association
  ```
- [ ] **End-to-end test** — send a password reset email to a device running the app, tap the link, confirm it opens the in-app screen (not Safari)

### 1C. Push Notifications / APNs (code complete)

- [ ] Confirm EAS production build profile sets `aps-environment = production` (not `development`) — check by running `eas build --platform ios --profile production` and inspecting the signed entitlements in the `.ipa`

### 1D. Privacy Manifest

- [ ] Audit `mobile/ios/Monevo/PrivacyInfo.xcprivacy` — ensure it declares every required reason API your app uses (UserDefaults, file timestamps, disk space, etc.). Apple rejects apps with missing or incorrect entries since May 2024.

### 1E. EAS Build & App Store Submission

- [ ] Run: `eas build --platform ios --profile production`
- [ ] Run: `eas submit --platform ios`
- [ ] Complete App Store Connect metadata: screenshots (6.5" + 5.5" + iPad), description, keywords, age rating, privacy URL
- [ ] Submit for App Review — first review typically takes 1–3 days

---

## 2. RevenueCat Web SDK

### 2A. RC Dashboard setup (web project)

- [ ] Create a **separate RC project** for web (or a new app within the existing project)
- [ ] Enable **RC Billing** (Stripe integration) in project settings and connect your Stripe account
- [ ] Create entitlement named exactly: **`Monevo Educational Pro`**
- [ ] Create 3 products backed by Stripe prices:
  - `monthly` → link to your Stripe monthly price
  - `yearly` → link to your Stripe yearly price
  - `lifetime` → link to your Stripe one-time price
- [ ] Add the 3 products to the **default offering** using package identifiers `$rc_monthly`, `$rc_annual`, `$rc_lifetime`
- [ ] Configure the **Customer Center** in RC Dashboard (cancel flow, support links, etc.)

### 2B. API key & install

- [ ] Install the package (not yet installed — just added to `package.json`):
  ```
  cd frontend && npm install
  # or from monorepo root:
  pnpm install
  ```
- [ ] The test key `test_WBWezUIwSVIhIRuQzfpxJWWXhIQ` is already in `frontend/.env`. For production, replace it with the **live public key** from RC Dashboard → API Keys. Never commit the live key; use an environment variable in your CI/CD pipeline instead.

### 2C. Logout hook

- [ ] Call `resetRevenueCat()` from `frontend/src/services/revenueCatService.ts` in the `logoutUser` function inside `frontend/src/contexts/AuthContext.tsx` so the singleton is cleared between users:
  ```ts
  import { resetRevenueCat } from "services/revenueCatService";
  // inside logoutUser:
  resetRevenueCat();
  ```

### 2D. Backend webhook (web purchases)

- [ ] The existing `backend/authentication/views_revenuecat.py` webhook handler works for both mobile and web RC events. Confirm the webhook URL registered in the **web** RC project also points to `https://monevo.tech/api/auth/revenuecat-webhook/` with the same `REVENUECAT_WEBHOOK_SECRET`.

### 2E. End-to-end test

- [ ] Open `/subscriptions`, click a paid plan → RC Paywall overlay appears with Monthly/Yearly/Lifetime cards
- [ ] Complete a test purchase (use RC sandbox/Stripe test mode) → entitlement `Monevo Educational Pro` becomes active → user is redirected to `/personalized-path`
- [ ] Open `/billing` → "Manage subscription" opens the RC Customer Center overlay
- [ ] Click "Restore purchases" → previous entitlement is restored without a new charge

---

## 3. Phase 2 — Post-Launch Polish (not started)

These are non-blocking quality improvements for after the iOS launch.

- [ ] **Native charts** — add `victory-native` for Portfolio Analyzer + Goals screens; keep WebView for Economic Calendar and Market Explorer
- [ ] **Real drag-and-drop** — add `react-native-reanimated` + `react-native-gesture-handler`, rewrite `mobile/src/components/exercises/DragAndDrop.tsx`
- [ ] **Screen animations** — quiz card flips, streak bounce, screen transitions with Reanimated
- [ ] **HTML renderer hardening** — add table, figure, blockquote, oembed renderers in `mobile/src/components/courses/TextSection.tsx`
- [ ] **Friends/social screen** — `mobile/app/friends.tsx` using the existing `backend/authentication/views_friends.py` endpoints
- [ ] **Offline queue** — wire `mobile/src/utils/offlineQueue.ts` to `@react-native-community/netinfo` reconnect event

## 4. Phase 3 — Growth (not started)

- [ ] **Android / Google Play** — RevenueCat already handles Google Play Billing; main work is Play Console setup + APK signing
- [ ] **Apple App Attest** — replace the `client_type=mobile` reCAPTCHA bypass with cryptographic device attestation
- [ ] **Streaming AI Tutor** — SSE responses via an EventSource polyfill in the mobile HTTP client
- [ ] **Voice input** — `expo-av` is already installed; wire it to the AI Tutor input field
