import { Alert } from "react-native";
import { router } from "expo-router";
import { attachToken, configureHttpClient } from "@monevo/core";
import { tokenStorage } from "../auth/tokenStorage";

let initialized = false;

export function initHttpClientMobile() {
  if (initialized) return;
  initialized = true;

  configureHttpClient({
    onAuthFailure: () => {
      void (async () => {
        await tokenStorage.clearAll();
        attachToken(null);
        router.replace("/login");
      })();
    },
    onError: (msg) => {
      Alert.alert("Error", String(msg));
    },
  });
}
