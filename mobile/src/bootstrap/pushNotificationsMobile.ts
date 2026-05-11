import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { submitExpoPushToken } from "@garzoni/core";
import { tokenStorage } from "../auth/tokenStorage";
import {
  identifyGarzoniUserFromAccessToken,
  registerPushTokenWithCustomerIo,
} from "./customerIoMobile";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolveEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId;
}

export async function registerForPushAndSubmitToken(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (Platform.OS === "web") {
    return { ok: false, message: "Push is not available on web." };
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return { ok: false, message: "Notification permission was not granted." };
  }

  try {
    const projectId = resolveEasProjectId();
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenRes.data;
    if (!token) {
      return { ok: false, message: "Could not read Expo push token." };
    }
    await submitExpoPushToken(token);

    const access = await tokenStorage.getAccess();
    if (access) {
      await identifyGarzoniUserFromAccessToken(access);
    }

    // Customer.io needs the *native* APNs (iOS) / FCM (Android) device token —
    // not the Expo push token. Expo's getDevicePushTokenAsync returns the raw token.
    // Retry once on failure: first call after permission grant can race the OS.
    let nativeToken = "";
    for (let attempt = 0; attempt < 2 && !nativeToken; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 750));
        }
        const native = await Notifications.getDevicePushTokenAsync();
        const raw = native?.data as unknown;
        nativeToken =
          typeof raw === "string"
            ? raw
            : raw != null && raw !== undefined
              ? String(raw)
              : "";
      } catch (e) {
        if (__DEV__) {
          console.warn(
            `[push] getDevicePushTokenAsync attempt ${attempt + 1} failed:`,
            e,
          );
        }
      }
    }
    if (nativeToken) {
      try {
        await registerPushTokenWithCustomerIo(nativeToken);
      } catch (e) {
        try {
          await registerPushTokenWithCustomerIo(nativeToken);
        } catch (e2) {
          if (__DEV__) {
            console.warn(
              "[push] registerPushTokenWithCustomerIo failed twice:",
              e2 ?? e,
            );
          }
        }
      }
    } else if (__DEV__) {
      console.warn("[push] no native device token after retry");
    }

    return { ok: true, message: "Notifications enabled." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Push registration failed.";
    return { ok: false, message: msg };
  }
}
