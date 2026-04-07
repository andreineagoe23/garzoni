import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "garzoni_access_token";
const REFRESH_KEY = "garzoni_refresh_token";

async function safeDelete(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* missing key */
  }
}

export const tokenStorage = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  setAccess: (t: string) => SecureStore.setItemAsync(ACCESS_KEY, t),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  setRefresh: (t: string) => SecureStore.setItemAsync(REFRESH_KEY, t),
  clearRefresh: () => safeDelete(REFRESH_KEY),
  clearAll: async () => {
    await safeDelete(ACCESS_KEY);
    await safeDelete(REFRESH_KEY);
  },
};
