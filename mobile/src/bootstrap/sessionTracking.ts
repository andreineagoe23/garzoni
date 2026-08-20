import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { trackGarzoniEvent } from "./customerIoMobile";

const APP_OPENED_LAST_YMD_KEY = "@cio/app_opened_last_fired_ymd";

function todayYmdLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Emit `app_opened` to Customer.io at most once per device-local day. Powers
 * the inactivity segments (which check "no app_opened event in last N days")
 * without spamming trait writes on every foreground.
 *
 * Safe to call from cold-start hydration AND from AppState 'active' — the
 * AsyncStorage gate dedupes identical YMD values.
 */
export async function fireAppOpenedDaily(): Promise<void> {
  try {
    const today = todayYmdLocal();
    const last = await AsyncStorage.getItem(APP_OPENED_LAST_YMD_KEY);
    if (last === today) return;
    await trackGarzoniEvent("app_opened", {
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? "unknown",
    });
    await AsyncStorage.setItem(APP_OPENED_LAST_YMD_KEY, today);
  } catch {
    /* noop — telemetry must never crash the app */
  }
}
