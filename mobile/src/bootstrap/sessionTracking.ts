import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { APP_OPENED_LAST_YMD_KEY, runAppOpenedDailyGate } from "@garzoni/core";

import { trackGarzoniEvent } from "./customerIoMobile";

/**
 * Emit `app_opened` to Customer.io at most once per device-local day. Powers
 * the inactivity segments (which check "no app_opened event in last N days")
 * without spamming trait writes on every foreground.
 *
 * Safe to call from cold-start hydration AND from AppState 'active' — the
 * stored YMD gate dedupes. The gate itself lives in @garzoni/core so web fires
 * the same event on the same schedule; see fireAppOpenedDailyWeb.
 */
export async function fireAppOpenedDaily(): Promise<void> {
  await runAppOpenedDailyGate({
    readLastFired: () => AsyncStorage.getItem(APP_OPENED_LAST_YMD_KEY),
    writeLastFired: (ymd) => AsyncStorage.setItem(APP_OPENED_LAST_YMD_KEY, ymd),
    track: () =>
      trackGarzoniEvent("app_opened", {
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? "unknown",
      }),
  });
}
