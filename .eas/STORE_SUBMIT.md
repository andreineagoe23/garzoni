# EAS store submission (production workflow)

The workflow [`.eas/workflows/create-production-builds.yml`](create-production-builds.yml) builds iOS and Android, then runs **submit** jobs that upload those binaries using the `production` submit profile from [`mobile/eas.json`](../mobile/eas.json).

## Required Expo / EAS configuration

1. **Apple (iOS)** — App Store Connect API key or Apple ID session configured for the Expo account (see [Submit to App Store](https://docs.expo.dev/submit/ios/)).
2. **Google (Android)** — Service account JSON for Play Developer API linked in EAS credentials (see [Submit to Google Play](https://docs.expo.dev/submit/android/)). Android submits use `track: production` and `releaseStatus: draft` so you can promote manually in Play Console until you are confident in automation.

## Workflow secrets

Submission in CI/CD may require environment variables or uploaded credentials as described in Expo’s **Google Play Store CI/CD submission** and **Apple App Store CI/CD submission** guides. If submit jobs fail on missing credentials, fix credentials in the Expo dashboard first; you can temporarily remove the `submit_ios` / `submit_android` jobs from the workflow YAML while iterating on builds only.

## Sentry (mobile native / source maps)

- **Runtime:** set **`EXPO_PUBLIC_SENTRY_DSN`** to the **DSN** from Sentry → Project **apple-ios** → *Client Keys (DSN)* (not an auth token).
- **Build-time uploads:** create an **Auth Token** (Settings → Account → API → Auth Tokens) with scopes needed for releases/source maps, then add **`SENTRY_AUTH_TOKEN`** as an EAS secret for production builds.
- **Org / project:** [`mobile/app.config.js`](../mobile/app.config.js) defaults to **`SENTRY_ORG=garzoni`** and **`SENTRY_PROJECT=apple-ios`** so you only need to override env if you rename the project. The native **Configure iOS SDK** wizard in Sentry is for pure Xcode apps; this Expo app uses **`@sentry/react-native`** instead — no Swift wizard run required.

JS initialization is skipped when `EXPO_PUBLIC_SENTRY_DSN` is unset.
