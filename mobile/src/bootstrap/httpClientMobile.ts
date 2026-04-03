import { Alert } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import {
  attachToken,
  configureBackendUrl,
  configureHttpClient,
} from "@monevo/core";
import { tokenStorage } from "../auth/tokenStorage";

let initialized = false;

export function initHttpClientMobile() {
  if (initialized) return;
  initialized = true;

  const fromExtra = Constants.expoConfig?.extra?.backendUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    configureBackendUrl(fromExtra.trim());
  }

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
