import { Alert } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import {
  attachToken,
  configureBackendUrl,
  configureCloudinaryCloudName,
  configureHttpClient,
} from "@monevo/core";
import { tokenStorage } from "../auth/tokenStorage";
import { resolveBackendUrlFromExpo } from "./resolveBackendUrl";

let initialized = false;

export function initHttpClientMobile() {
  if (initialized) return;
  initialized = true;

  const resolved = resolveBackendUrlFromExpo();
  if (resolved) {
    configureBackendUrl(resolved);
  } else if (__DEV__) {
    console.warn(
      "[Monevo] EXPO_PUBLIC_BACKEND_URL is not set. API calls will use the default (localhost), which fails on a real device. Set it to your Railway API URL in mobile/.env and restart Expo."
    );
  }

  const cloudName = Constants.expoConfig?.extra?.cloudinaryCloudName;
  if (typeof cloudName === "string" && cloudName.trim()) {
    configureCloudinaryCloudName(cloudName.trim());
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
