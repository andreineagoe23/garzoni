# Android credentials checklist (Garzoni mobile)

Project-specific checklist of every credential, file, and dashboard step
required to ship `app.garzoni.mobile` on Google Play. Tick boxes as you go.

> Anchors used by other docs:
> - Package name: `app.garzoni.mobile`
> - EAS project id: `65781f5d-673f-484b-866c-b8dc165a160b`
> - EAS slug / owner: `garzoni` / `andreineagoe`
> - Customer.io region: `eu` (CDP key already shared with iOS)
> - Sentry org / Android project: `garzoni` / `garzoni-android`

---

## 0. Prerequisites (accounts)

- [x] **Google Play Developer account** ($25 one-time)
  - Sign-up: <https://play.google.com/console/signup>
  - Use the same Google account that owns the Cloud project below.
- [x] **Google Cloud project** linked to that Google account
  - Console: <https://console.cloud.google.com/>
  - Reuse the existing GCP project that already owns the Google Sign-In
    web/iOS clients (`662909168223-…`).
- [x] **Firebase project** (wraps the Cloud project; needed for FCM push)
  - Attached to existing GCP project `rare-phoenix-492615-p5`
    (project number `662909168223`), which already owns the Google
    Sign-In Web/iOS clients. The misplaced `garzoni-android` Firebase
    project (`511104274240`) was abandoned.

---

## 1. Android upload keystore

What it is: signs every AAB. With Play App Signing this is the *upload*
key (Google can reset it if lost), not the final signing key.

- [x] Run `cd mobile && pnpm exec eas credentials`
  → Android → production → "Set up a new keystore" (let EAS generate it).
- [x] Confirm visible at
  <https://expo.dev/accounts/andreineagoe/projects/garzoni/credentials>
  → Android → `app.garzoni.mobile`.
- [ ] (Later, after first Play upload) Enrol in **Play App Signing**:
  Play Console → Garzoni → Setup → App integrity → App signing.

EAS-generated upload keystore (created 2026-06-02):

```
Build Credentials   gzXV06sgg0 (Default)
Type                JKS
Key Alias           4b3da1c921102ed3b378a8f79aab98f1
MD5 Fingerprint     5E:7E:6A:69:CC:05:CF:24:3B:9F:6C:2C:4A:D5:E7:72
SHA1 Fingerprint    1A:49:4A:8C:74:CE:3B:B6:CF:B5:AF:41:89:26:21:64:AF:D2:4C:6E
SHA256 Fingerprint  5A:DF:05:2F:18:98:CA:97:5A:48:D1:9B:E4:8E:B9:68:63:8E:03:D3:56:B8:B3:3A:5F:07:60:11:2F:AE:0A:0B
```

> Fingerprints aren’t secrets (Play publishes the Play App Signing SHA-1
> publicly). The keystore *file* and its passwords are managed by EAS;
> never download or commit them.

---

## 2. Fingerprints (collected once, reused everywhere)

You need three sets of SHA-1 + SHA-256 fingerprints:

- [x] **Upload key** fingerprints (see §1 — captured 2026-06-02)
  - `pnpm exec eas credentials` → Android → "Print certificate fingerprints"
  - or EAS dashboard → Credentials → app → "Show fingerprint"
- [ ] **Play App Signing certificate** fingerprints
  - Play Console → Garzoni → Setup → App integrity → App signing
  - "App signing key certificate" → copy SHA-1 and SHA-256
  - (Available only after the first AAB is uploaded to a track.)
- [ ] **Debug keystore** SHA-1 (for `expo run:android` / dev client)
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore \
    -alias androiddebugkey -storepass android -keypass android
  ```

Paste the values somewhere safe — they’re used in steps 3, 4, and 9.

---

## 3. `google-services.json` (FCM config — referenced in `app.json`)

`mobile/google-services.json` is sourced from the Firebase project attached
to GCP project `rare-phoenix-492615-p5` (`662909168223`). It already
auto-detects the existing Web + iOS OAuth clients. Firebase did not add
the Android OAuth client to the file, so it was created manually in §4;
the file is still valid for FCM and EAS builds.

- [x] Firebase Console → project → ⚙️ Project Settings → "Your apps"
  → **Add app → Android**
- [x] Package name: `app.garzoni.mobile`
- [x] Add SHA-1 of upload key (step 2). Add Play App Signing SHA-1 too
  once you have it (you can come back later — Firebase lets you add more).
  → **Re-download `google-services.json` after Play App Signing SHA-1 is added.**
- [x] Click **Download `google-services.json`**
- [x] Save to `mobile/google-services.json`
- [x] Verify `mobile/.gitignore` ignores it (added 2026-06-02)
- [x] Upload to EAS so cloud builds work:
  ```bash
  cd mobile
  pnpm exec eas env:create --scope project \
    --environment preview --environment production \
    --name GOOGLE_SERVICES_JSON --type file \
    --visibility secret --value ./google-services.json
  ```
  `app.config.js` resolves `android.googleServicesFile` from this file
  env var during EAS builds.

---

## 4. Google OAuth **Android** client(s)

Currently `eas.json` only has a Web + iOS client. Android Google Sign-In
also needs an Android-type OAuth client (it’s used for server-side
package + SHA-1 verification, not referenced in app code).

- [x] Google Cloud Console → APIs & Services → **Credentials**
  → Create credentials → **OAuth client ID → Android**
  - Name: `garzoni-android`
  - Client ID:
    `662909168223-c0tok05sta4ugie3pvpgd1ich8qfgsra.apps.googleusercontent.com`
  - Package: `app.garzoni.mobile`
  - SHA-1:
    `1A:49:4A:8C:74:CE:3B:B6:CF:B5:AF:41:89:26:21:64:AF:D2:4C:6E`
- [ ] Repeat with **Play App Signing** SHA-1
  - Name: `Garzoni Android (Play signing)`
- [x] (Optional shortcut) Firebase did not auto-create this client, so it
  was created manually in Cloud Console.

> Code change: none. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (already set)
> stays the value passed to `GoogleSignin.configure`.

---

## 5. FCM service account JSON (Customer.io push)

Lets Customer.io’s servers send pushes via FCM v1 to your Android users.
This is **separate from `google-services.json`**.

- [x] Firebase Console → ⚙️ Project Settings → **Service accounts** tab
  → **Generate new private key** → download JSON
  - Because org policy blocked console key creation, generated via gcloud
    after temporarily disabling `iam.disableServiceAccountKeyCreation`
    for project `rare-phoenix-492615-p5`.
- [x] Customer.io EU dashboard → Settings → **Workspace Settings → Push**
  → next to **Android (FCM)** click **Settings**
  → **Choose file** → upload the JSON → Save
- [x] Delete local JSON after uploading to Customer.io
  - Deleted `~/Downloads/garzoni-fcm-service-account.json`
- [ ] Send a test push from CIO to a real device (after first build)

Reference: <https://docs.customer.io/journeys/push-developer-guide/#fcm-setup>

---

## 6. Google Play service account JSON (`eas submit`)

Already referenced in `mobile/eas.json`:

```json
"android": {
  "serviceAccountKeyPath": "./play-store-service-account.json",
  "track": "production",
  "releaseStatus": "draft"
}
```

- [x] Cloud Console → APIs & Services → **Library**
  → enable **Google Play Android Developer API**
  → enable **Google Play Developer Reporting API**
- [x] IAM & Admin → **Service Accounts** → Create
  - Name: `eas-play-submit`
  - Skip role assignment → Done
- [x] Open the service account → **Keys** → Add key → **Create new key → JSON**
- [x] Save to `mobile/play-store-service-account.json` (gitignored)
  - Client email:
    `eas-play-submit@rare-phoenix-492615-p5.iam.gserviceaccount.com`
- [ ] Play Console → **Setup → API access** → find the service account email
  → **Manage Play Console permissions** → grant:
  - Release to production, exclude devices, and use Play App Signing
  - Release apps to testing tracks
  - Manage store presence
  - View app information and download bulk reports (read-only)
  → Apply → Invite user
- [ ] (Recommended) Upload the same JSON to EAS dashboard:
  Project → Credentials → Android → "Add a Google Service Account Key".
  Once uploaded, you can drop `serviceAccountKeyPath` from `eas.json`.

Reference: <https://docs.expo.dev/submit/android/>

---

## 7. RevenueCat (Android)

Replace the placeholder in `eas.json`:

```json
"EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "goog_PLACEHOLDER_REPLACE_BEFORE_ANDROID_RELEASE"
```

### 7a. RevenueCat Android public API key
- [ ] RevenueCat dashboard → project → Apps → **+ New → Google Play Store**
- [ ] Package name: `app.garzoni.mobile`
- [ ] Copy the public Android key (starts with `goog_`)
- [ ] Replace placeholder in all three profiles of `mobile/eas.json`
  *or* move to an EAS secret named `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`

### 7b. RevenueCat billing service account JSON (separate from step 6)
- [ ] In the same GCP project, IAM & Admin → Service Accounts → Create
  - Name: `revenuecat-billing` (keep separate from `eas-play-submit`)
- [ ] Service account → Keys → Add key → JSON → download
- [ ] Play Console → Users and permissions → **Invite new users**
  - Email: the service account email
  - App permissions on Garzoni:
    - View app information
    - View financial data, orders, and cancellation survey response
    - Manage orders and subscriptions
- [ ] RevenueCat → Garzoni Android app → **Service Account credentials JSON**
  → upload → Save changes
- [ ] Wait up to 36 h for Google to propagate permissions

### 7c. Real-Time Developer Notifications (Pub/Sub)
- [ ] Cloud Console → Pub/Sub → Create topic, e.g. `play-rtdn-garzoni`
- [ ] Topic permissions → grant `revenuecat-billing` the **Pub/Sub Editor** role
- [ ] Play Console → Monetize → **Monetization setup**
  → paste topic name `projects/<gcp-project-id>/topics/play-rtdn-garzoni`
- [ ] RevenueCat → Garzoni Android app → paste same topic ID

### 7d. License testing (so purchases don’t actually charge)
- [ ] Play Console → **Settings → License testing**
  → add Gmail addresses of testers (real device required, no emulators)

References:
- <https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials>
- <https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials/google-play-checklists>

---

## 8. Subscription products in Play Console

- [ ] Play Console → Garzoni → **Monetize → Products → Subscriptions**
- [ ] Create the same product IDs you use on App Store Connect
- [ ] Activate at least one base plan per product
- [ ] Confirm products show up in RevenueCat → Products tab

> You must upload an AAB to at least the Internal testing track before
> the Subscriptions UI is editable.

---

## 9. Digital Asset Links (`assetlinks.json`)

Required because `app.json` sets `autoVerify: true` on the App Links
intent filter for `garzoni.app` and `www.garzoni.app`. Without this file
Android will refuse to deep-link from clicked URLs.

- [ ] Generate via the official wizard:
  <https://developers.google.com/digital-asset-links/tools/generator>
  - Hosting site: `garzoni.app`
  - Package: `app.garzoni.mobile`
  - SHA-256: paste **both** upload-key SHA-256 *and* Play App Signing
    SHA-256 from step 2 (two array entries)
- [ ] Host the file at:
  - `https://garzoni.app/.well-known/assetlinks.json`
  - `https://www.garzoni.app/.well-known/assetlinks.json`
- [ ] Served as `application/json`, HTTPS, no redirects
- [ ] Verify on a real device:
  ```bash
  adb shell pm verify-app-links --re-verify app.garzoni.mobile
  adb shell pm get-app-links app.garzoni.mobile
  ```
  Expect every host → `verified`.

---

## 10. Sentry Android project + auth token

`mobile/app.config.js` already routes Android builds to project
`garzoni-android` (org `garzoni`).

- [ ] Sentry → Projects → **Create Project**
  - Platform: React Native
  - Name: `garzoni-android`
  - Team: same as iOS
- [ ] Sentry → Settings → Account → API → **Auth tokens** → New token
  - Scopes: `project:releases`, `project:write`, `org:read`
- [ ] Add as EAS secret so source-map upload works in cloud builds:
  ```bash
  cd mobile
  pnpm exec eas secret:create --scope project \
    --name SENTRY_AUTH_TOKEN --value <token>
  ```
- [ ] Confirm a test event arrives from a release build
  (deliberately throw, then check `garzoni-android` in Sentry).

---

## 11. Already covered (no Android-specific work)

| Credential | Where it’s set | Action |
| --- | --- | --- |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `mobile/eas.json` (all profiles) | None |
| `EXPO_PUBLIC_BACKEND_URL` (Railway) | `mobile/eas.json` | None |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | `mobile/eas.json` | None |
| `EXPO_PUBLIC_CIO_*` (CDP key, site id, region) | `mobile/eas.json` | None — but step 5 must be done for delivery |
| `extra.eas.projectId` | `mobile/app.json` | None |

---

## 12. Things you do **not** need

- APNs key / iOS push cert (iOS-only)
- A separate Apple Sign-In credential on Android (gated to iOS in code)
- A second EAS project id (Android reuses `65781f5d-…`)
- Google Maps / Geocoding API key (not used)

---

## Suggested order of operations

1. Upload keystore via EAS (§1)
2. Print upload SHA-1 / SHA-256 (§2 partial)
3. Firebase Android app + `google-services.json` (§3)
4. Android OAuth clients in Cloud Console (§4)
5. Firebase service-account JSON → upload to Customer.io (§5)
6. Play submit service account → save to repo or EAS (§6)
7. `eas build --profile preview --platform android` → upload to **Internal testing**
8. Pull Play App Signing SHA-1/SHA-256 → add to Firebase, add OAuth client,
   regenerate `assetlinks.json` (§2 finish, §3, §4, §9)
9. RevenueCat: app + key in `eas.json`, billing service account, Pub/Sub topic (§7)
10. Create products in Play Console, link to RevenueCat (§8)
11. Sentry Android project + auth token EAS secret (§10)
12. `eas submit --profile production --platform android`

---

## Useful links (one place)

- Expo: submit Android — <https://docs.expo.dev/submit/android/>
- Expo: app signing — <https://docs.expo.dev/app-signing/app-credentials/>
- React Native Google Sign-In setup — <https://react-native-google-signin.github.io/docs/setting-up/get-config-file>
- Customer.io push (FCM) — <https://docs.customer.io/journeys/push-developer-guide/#fcm-setup>
- RevenueCat Play credentials — <https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials>
- RevenueCat checklist — <https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials/google-play-checklists>
- Digital Asset Links generator — <https://developers.google.com/digital-asset-links/tools/generator>
