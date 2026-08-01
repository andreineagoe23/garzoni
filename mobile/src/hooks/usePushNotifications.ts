import { useEffect, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import {
  fetchUserSettings,
  queryKeys,
  resolvePushEnabled,
  staleTimes,
} from "@garzoni/core";
import {
  registerForPushAndSubmitToken,
  setupNotificationResponseHandlers,
} from "../bootstrap/pushNotificationsMobile";

export const LAST_REGISTERED_KEY = "push_last_registered_at";
const REREGISTER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function clearPushRegistrationFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_REGISTERED_KEY);
  } catch {}
}

async function shouldReregister(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_REGISTERED_KEY);
    if (!raw) return true;
    return Date.now() - Number(raw) > REREGISTER_INTERVAL_MS;
  } catch {
    return true;
  }
}

async function markRegistered(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_REGISTERED_KEY, String(Date.now()));
  } catch {}
}

export async function forceReregisterPushToken(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    await AsyncStorage.removeItem(LAST_REGISTERED_KEY);
  } catch {}
  const result = await registerForPushAndSubmitToken();
  if (result.ok) await markRegistered();
  return result;
}

export function usePushNotifications(isAuthenticated: boolean) {
  const registeredRef = useRef(false);

  const settingsQ = useQuery({
    queryKey: queryKeys.userSettings(),
    queryFn: () => fetchUserSettings().then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: staleTimes.profile,
  });

  // The switch lives under `email_preferences.push_notifications`; reading the
  // top-level key alone always yielded `undefined` (→ "allowed"), so a user who
  // disabled push kept getting their token re-registered every 24h.
  const pushAllowed = resolvePushEnabled(settingsQ.data);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Deep-link routing for notification taps. Idempotent, and independent of
    // the push preference — locally scheduled reminders and notifications that
    // arrived before the user opted out still need to route on tap.
    setupNotificationResponseHandlers();

    async function tryRegister() {
      if (!pushAllowed) return;
      if (!(await shouldReregister())) return;
      // Never prompt from here: this runs on every foreground and would burn the
      // one-shot iOS dialog cold, before the onboarding priming screen gets to
      // make the case for it.
      const result = await registerForPushAndSubmitToken({ prompt: false });
      if (result.ok) {
        await markRegistered();
        registeredRef.current = true;
      }
    }

    // Badge count is an app-icon-wide unread indicator, not tied to the push
    // preference — clear it whenever the user brings the app to the
    // foreground so it never sticks around after they've seen the app.
    // Reuses this same foreground listener rather than adding a second one.
    function clearBadge() {
      if (Platform.OS === "web") return;
      void Notifications.setBadgeCountAsync(0);
    }

    void tryRegister();
    clearBadge();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active") return;
      void tryRegister();
      clearBadge();
    });

    return () => sub.remove();
  }, [isAuthenticated, pushAllowed]);
}
