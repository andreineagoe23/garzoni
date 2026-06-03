import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

// app.config.js resolves the DSN per platform (iOS → apple-ios, Android →
// garzoni-android) and exposes it via `extra.sentryDsn`. Fall back to the
// shared env var for safety (e.g. older builds / local dev).
const dsn = (
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined) ??
  process.env.EXPO_PUBLIC_SENTRY_DSN
)?.trim();
const version = Constants.expoConfig?.version ?? "unknown";
const env = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

// Patterns that are expected failures, not bugs worth an alert.
const IGNORED_ERRORS = [
  // Network / connectivity — not actionable
  /Network request failed/i,
  /Failed to fetch/i,
  /The Internet connection appears to be offline/i,
  /NetworkError/i,
  /AbortError/i,
  /Request timed out/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  // Cancelled navigation / promise cleanup
  /navigation was cancelled/i,
  /The operation couldn't be completed/i,
  // Expo Router navigation during hot reload
  /Cannot read properties of undefined.*navigation/i,
  // RevenueCat — surfaces when store is unavailable
  /StoreKit/i,
  /SKErrorDomain/i,
];

// Always initialize so Sentry.wrap() does not throw when DSN is unset (dev).
Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn) && env !== "development",
  release: `garzoni-mobile@${version}`,
  environment: env,

  // Capture all unhandled errors; sample only 10% of perf traces.
  sampleRate: 1.0,
  tracesSampleRate: env === "production" ? 0.1 : 0,

  // Keep breadcrumb trail tight — 50 is enough context without drowning the event.
  maxBreadcrumbs: 50,

  // Drop expected / non-actionable errors before they leave the device.
  beforeSend(event, hint) {
    const err = hint?.originalException;
    const msg =
      typeof err === "string"
        ? err
        : ((err as Error)?.message ?? event.message ?? "");
    if (IGNORED_ERRORS.some((re) => re.test(msg))) return null;
    return event;
  },

  // Attach UI hierarchy for crash context without full screenshots (smaller payload).
  attachViewHierarchy: true,
});

export { Sentry };
