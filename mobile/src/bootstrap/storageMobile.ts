import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { configureStorage } from "@garzoni/core";

let initialized = false;

/** Keys that were used by removed features. Cleared once on launch so old devices don't keep stale state. */
const DEPRECATED_ASYNC_STORAGE_KEYS: readonly string[] = [
  "garzoni:profile_tagline",
];

export function initStorageMobile() {
  if (initialized) return;
  initialized = true;

  configureStorage({
    getItem: (k) => SecureStore.getItemAsync(k),
    setItem: (k, v) => SecureStore.setItemAsync(k, v),
    removeItem: (k) => SecureStore.deleteItemAsync(k).catch(() => {}),
  });

  void AsyncStorage.multiRemove([...DEPRECATED_ASYNC_STORAGE_KEYS]).catch(
    () => {},
  );
}
