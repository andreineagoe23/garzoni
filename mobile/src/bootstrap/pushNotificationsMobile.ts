import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { submitExpoPushToken } from "@garzoni/core";

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
      projectId ? { projectId } : undefined
    );
    const token = tokenRes.data;
    if (!token) {
      return { ok: false, message: "Could not read Expo push token." };
    }
    await submitExpoPushToken(token);
    return { ok: true, message: "Notifications enabled." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Push registration failed.";
    return { ok: false, message: msg };
  }
}
