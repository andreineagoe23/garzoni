import { DeviceEventEmitter } from "react-native";
import { attachToken, queryClient } from "@garzoni/core";
import { clearRevenueCatSession } from "../billing/subscriptionRuntime";
import { clearGarzoniCustomerIo } from "../bootstrap/customerIoMobile";
import { tokenStorage } from "./tokenStorage";
import {
  clearPlanChosenCache,
  clearWelcomeHeaderPending,
  clearWelcomeSeen,
} from "./firstRunFlags";

/** Fired when session storage is cleared outside `AuthContext` (e.g. HTTP 401 refresh failure). */
export const NATIVE_AUTH_STORAGE_CLEARED = "garzoni:native-auth-storage-cleared";

export function notifyNativeAuthStorageCleared(): void {
  DeviceEventEmitter.emit(NATIVE_AUTH_STORAGE_CLEARED);
}

/**
 * Clears native auth storage, RevenueCat, first-run flags, and React Query cache.
 * Callers should also clear any in-memory auth state (e.g. `setAccessToken(null)`),
 * or call `notifyNativeAuthStorageCleared()` if clearing from outside React.
 */
export async function resetNativeSessionStores(): Promise<void> {
  await clearGarzoniCustomerIo();
  await clearRevenueCatSession();
  await clearPlanChosenCache();
  await clearWelcomeSeen();
  await clearWelcomeHeaderPending();
  await tokenStorage.clearAll();
  attachToken(null);
  queryClient.clear();
}
