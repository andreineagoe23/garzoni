import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const version = Constants.expoConfig?.version ?? "unknown";

// Always initialize so Sentry.wrap() does not run before init when DSN is unset (dev).
Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  release: `garzoni-mobile@${version}`,
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
});

export { Sentry };
