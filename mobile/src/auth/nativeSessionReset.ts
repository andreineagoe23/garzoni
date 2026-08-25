import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  attachToken,
  clearExpoPushToken,
  logout,
  queryClient,
} from "@garzoni/core";
import { clearRevenueCatSession } from "../billing/subscriptionRuntime";
import { clearGarzoniCustomerIo } from "../bootstrap/customerIoMobile";
import { clearPushRegistrationFlag } from "../hooks/usePushNotifications";
import { clearCfoProfileStorage } from "../state/cfoProfile";
import { tokenStorage } from "./tokenStorage";
import {
  clearPlanChosenCache,
  clearWelcomeHeaderPending,
  clearWelcomeSeen,
} from "./firstRunFlags";

const CHAT_HISTORY_STORAGE_KEY = "garzoni:chat:history:v1";

/** Fired when session storage is cleared outside `AuthContext` (e.g. HTTP 401 refresh failure). */
export const NATIVE_AUTH_STORAGE_CLEARED =
  "garzoni:native-auth-storage-cleared";

export function notifyNativeAuthStorageCleared(): void {
  DeviceEventEmitter.emit(NATIVE_AUTH_STORAGE_CLEARED);
}

/**
 * Monotonically-increasing counter. Incremented each time a new session starts
 * (i.e. `applyTokens` is called). The 401 refresh interceptor captures this
 * value before its async cleanup; if it changes by the time cleanup finishes a
 * new login happened mid-cleanup and the redirect + cache-clear are skipped.
 */
let _sessionVersion = 0;
export function bumpSessionVersion(): number {
  return ++_sessionVersion;
}
export function getSessionVersion(): number {
  return _sessionVersion;
}

/**
 * Clears native auth storage, RevenueCat, first-run flags, and React Query cache.
 * Pass `sessionVersion` (from `getSessionVersion()`) to skip `queryClient.clear()` if a
 * new login has started before this completes — prevents clobbering the new session's cache.
 * Callers should also clear any in-memory auth state (e.g. `setAccessToken(null)`),
 * or call `notifyNativeAuthStorageCleared()` if clearing from outside React.
 */
export async function resetNativeSessionStores(
  sessionVersion?: number,
): Promise<void> {
  const refresh = await tokenStorage.getRefresh();
  try {
    await logout(refresh ?? undefined);
  } catch {
    /* offline or session already invalid */
  }
  try {
    await clearExpoPushToken();
  } catch {
    /* offline or session already invalid */
  }
  try {
    await AsyncStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    await clearCfoProfileStorage();
  } catch {
    /* best-effort local cleanup */
  }
  await clearPushRegistrationFlag();
  try {
    const { cancelStreakReminder } = await import("../streak/streakReminder");
    await cancelStreakReminder();
  } catch {
    /* best-effort */
  }
  await clearGarzoniCustomerIo();
  await clearRevenueCatSession();
  await clearPlanChosenCache();
  await clearWelcomeSeen();
  await clearWelcomeHeaderPending();
  await tokenStorage.clearAll();
  attachToken(null);
  // Skip cache clear if a new login happened while we were running (interceptor re-entry).
  if (sessionVersion === undefined || getSessionVersion() === sessionVersion) {
    queryClient.clear();
  }
}
