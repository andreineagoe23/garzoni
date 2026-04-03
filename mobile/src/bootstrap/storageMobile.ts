import * as SecureStore from "expo-secure-store";
import { configureStorage } from "@monevo/core";

let initialized = false;

export function initStorageMobile() {
  if (initialized) return;
  initialized = true;

  configureStorage({
    getItem: (k) => SecureStore.getItemAsync(k),
    setItem: (k, v) => SecureStore.setItemAsync(k, v),
    removeItem: (k) => SecureStore.deleteItemAsync(k).catch(() => {}),
  });
}
