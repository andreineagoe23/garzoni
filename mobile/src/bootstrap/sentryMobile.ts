import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  const version = Constants.expoConfig?.version ?? "unknown";

  Sentry.init({
    dsn,
    enabled: true,
    release: `garzoni-mobile@${version}`,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
  });
}

export { Sentry };
