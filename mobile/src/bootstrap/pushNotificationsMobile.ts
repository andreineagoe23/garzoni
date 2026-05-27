import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { router } from "expo-router";
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

/**
 * Extract deeplink target from a notification payload. Convention:
 * - `data.deeplink`: a full URL (`garzoni://lesson/123`) or a path (`/lesson/123`).
 * - `data.route`: bare expo-router path (`/lesson/123`).
 */
function extractDeeplink(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data || typeof data !== "object") return null;
  const raw =
    (typeof data.deeplink === "string" && data.deeplink) ||
    (typeof data.route === "string" && data.route) ||
    null;
  if (!raw) return null;
  return raw;
}

async function navigateToDeeplink(target: string): Promise<void> {
  try {
    if (target.startsWith("garzoni://") || target.includes("://")) {
      await Linking.openURL(target);
      return;
    }
    // Treat as in-app path
    router.push(target as never);
  } catch (e) {
    if (__DEV__) {
      console.warn("[push] navigate failed", target, e);
    }
  }
}

let responseSubscription: Notifications.Subscription | null = null;
let coldStartHandled = false;

/**
 * Wire notification tap → deep-link navigation. Idempotent; safe to call on
 * every app foreground via usePushNotifications.
 */
export function setupNotificationResponseHandlers(): void {
  if (Platform.OS === "web") return;
  if (!responseSubscription) {
    responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const target = extractDeeplink(data ?? null);
        if (target) void navigateToDeeplink(target);
      },
    );
  }
  if (!coldStartHandled) {
    coldStartHandled = true;
    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const target = extractDeeplink(data ?? null);
        if (target) await navigateToDeeplink(target);
      } catch (e) {
        if (__DEV__) {
          console.warn("[push] cold-start handler failed", e);
        }
      }
    })();
  }
}

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
