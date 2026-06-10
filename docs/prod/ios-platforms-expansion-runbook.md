# iOS platform expansion runbook (Mac + Vision Pro)

Ship the existing universal iPhone/iPad binary to **Apple Silicon Macs** and **Apple Vision Pro** without a separate native target. The app already builds as `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone + iPad).

> Anchors:
>
> - Bundle id: `app.garzoni.mobile`
> - App Store Connect app id: `6761790801`
> - EAS project id: `65781f5d-673f-484b-866c-b8dc165a160b`
> - Current version: see `mobile/app.json` (`version` + `ios.buildNumber`)

---

## Phase 1 — Apple Silicon Mac (Mac App Store)

### 1a. Enable Mac availability (App Store Connect)

- [ ] Open [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **Garzoni**
- [ ] Go to **Pricing and Availability** → scroll to **Apple Silicon Mac Availability**
- [ ] Confirm **"Make this app available"** is checked (default unless previously opted out)
- [ ] Set minimum macOS version (recommend **macOS 13.0** or later; align with `ios.deploymentTarget` 15.1 + Apple's iPad-on-Mac baseline)

Direct help: [Manage availability on Macs with Apple silicon](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon)

### 1b. Enable Mac TestFlight testing

- [ ] App Store Connect → Garzoni → **TestFlight** tab
- [ ] Select your internal (or external) tester group → **Settings**
- [ ] Under **Test iPhone and iPad apps on Apple silicon Macs** → click **Enable**
- [ ] Install the latest production/preview build on this Mac via TestFlight

Local dev alternative (no TestFlight):

```bash
cd mobile
pnpm ios:mac
# or: pnpm exec expo run:ios --device "My Mac"
```

### 1c. Mac smoke-test checklist

Run on an Apple Silicon Mac (TestFlight or `pnpm ios:mac`):

| Flow                                                     | Pass? | Notes                                       |
| -------------------------------------------------------- | ----- | ------------------------------------------- |
| Cold launch + splash                                     | [ ]   |                                             |
| Apple Sign-In                                            | [ ]   | `expo-apple-authentication`                 |
| Google Sign-In                                           | [ ]   | `@react-native-google-signin/google-signin` |
| Email/password login                                     | [ ]   |                                             |
| Dashboard + lesson playback                              | [ ]   |                                             |
| RevenueCat paywall + sandbox purchase                    | [ ]   | StoreKit works for iPad apps on Mac         |
| Restore purchases                                        | [ ]   |                                             |
| Push notification (APNs)                                 | [ ]   | Register device token; send CIO test        |
| WebView tools (`EXPO_PUBLIC_WEB_APP_URL`)                | [ ]   |                                             |
| Deep link `https://www.garzoni.app/...`                  | [ ]   | Universal links                             |
| Receipt scan (`/scan`) — photo library pick              | [ ]   | Uses library, not camera                    |
| Voice tutor (`/voice-chat`) — mic record                 | [ ]   | May need Mac mic permission                 |
| Resizable window / landscape (after multitasking change) | [ ]   |                                             |

If a flow fails only on Mac, gate it in code via `isIOSAppOnMac()` from `mobile/src/utils/platform.ts` rather than opting out of Mac distribution.

### 1d. Verify Mac compatibility badge

After a build is uploaded and smoke tests pass:

- [ ] App Store Connect → **Pricing and Availability** → **Compatibility with Apple Silicon Macs**
- [ ] Click **Verify Compatibility** (requires at least one uploaded iOS build)
- [ ] Confirm listing shows verified status for current/future versions

---

## Phase 2 — Apple Vision Pro ("Designed for iPad")

### 2a. Enable Vision Pro availability (App Store Connect)

- [ ] App Store Connect → Garzoni → **Pricing and Availability**
- [ ] Scroll to **Apple Vision Pro Availability**
- [ ] Confirm **"Make this app available on Apple Vision Pro"** is checked (default unless opted out)

Direct help: [Manage availability on Apple Vision Pro](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro)

> Do **not** add a separate visionOS platform / universal purchase unless you plan a native visionOS target. The iPad compatibility listing is sufficient.

### 2b. Vision Pro simulator testing

Install a visionOS simulator in Xcode (**Settings → Platforms → visionOS**), then:

```bash
cd mobile
pnpm ios:vision
# Select an Apple Vision Pro simulator when prompted
```

Or in Xcode: open `mobile/ios/Garzoni.xcworkspace` → run on **Apple Vision Pro** simulator (runs the iOS build in "Designed for iPad" mode).

| Flow           | Pass? | Notes                       |
| -------------- | ----- | --------------------------- |
| Launch + login | [ ]   |                             |
| Lesson flow    | [ ]   | Portrait window is expected |
| Paywall        | [ ]   |                             |
| WebView tools  | [ ]   |                             |

Icon note: compatible iPad/iPhone apps show as rounded-square icons on visionOS — no asset change required.

---

## Phase 3 — Code/config changes (already in repo)

These ship with the next iOS build:

| Change                             | File                                      | Purpose                                        |
| ---------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| Removed `requireFullScreen`        | `mobile/app.json`, `mobile/app.config.js` | iPad Split View + resizable Mac/Vision windows |
| iPad landscape orientations        | `mobile/app.json`, `mobile/app.config.js` | Better wide layouts on Mac / Vision Pro        |
| `isIOSAppOnMac()` helper           | `mobile/src/utils/platform.ts`            | Optional feature gating                        |
| `pnpm ios:mac` / `pnpm ios:vision` | `mobile/package.json`                     | Local platform testing                         |

After merging, bump `ios.buildNumber` (and `version` if needed), then:

```bash
cd mobile
pnpm build:ios:prod
pnpm submit:ios:prod
```

---

## Phase 4 — Android production close-out

See [android-credentials-checklist.md](./android-credentials-checklist.md). Remaining manual steps:

- [ ] Promote Play production track from draft → staged/production rollout
- [ ] Customer.io test push to a real Android device
- [ ] `adb shell pm get-app-links app.garzoni.mobile` → all hosts `verified`
- [ ] Sentry test event in `garzoni-android` project
- [ ] Play Console → **Settings → License testing** → add tester Gmail accounts

`mobile/eas.json` production submit now uses `"releaseStatus": "completed"` (no longer draft).

---

## Out of scope

| Platform                                       | Why                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Native macOS (`react-native-macos` / Catalyst) | Not supported by Expo; Apple Silicon iPad route covers Mac              |
| tvOS                                           | Requires `react-native-tvos` fork; WebView/IAP/camera deps incompatible |
| watchOS                                        | No React Native path                                                    |

---

## Useful links

- [Test iPad apps on Apple silicon Macs (TestFlight)](https://developer.apple.com/help/app-store-connect/test-a-beta-version/test-iphone-and-ipad-apps-on-macs-with-apple-silicon)
- [Submit apps for Apple Vision Pro](https://developer.apple.com/visionos/submit/)
- [Expo additional platform support](https://docs.expo.dev/modules/additional-platform-support/)
