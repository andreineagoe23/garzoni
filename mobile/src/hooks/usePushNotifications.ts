import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerForPushAndSubmitToken } from "../bootstrap/pushNotificationsMobile";

const LAST_REGISTERED_KEY = "push_last_registered_at";
const REREGISTER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

export async function forceReregisterPushToken(): Promise<{ ok: boolean; message: string }> {
  try {
    await AsyncStorage.removeItem(LAST_REGISTERED_KEY);
  } catch {}
  const result = await registerForPushAndSubmitToken();
  if (result.ok) await markRegistered();
  return result;
}

export function usePushNotifications(isAuthenticated: boolean) {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function tryRegister() {
      if (!await shouldReregister()) return;
      const result = await registerForPushAndSubmitToken();
      if (result.ok) {
        await markRegistered();
        registeredRef.current = true;
      }
    }

    void tryRegister();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void tryRegister();
    });

    return () => sub.remove();
  }, [isAuthenticated]);
}
