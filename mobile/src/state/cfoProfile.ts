import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logDevError } from "../lib/logDevError";

export type CfoProfile = {
  goalName: string;
  goalAmount: string;
  months: string;
  currentSaved: string;
  incomeLow: string;
  incomeHigh: string;
  expenseLow: string;
  expenseHigh: string;
  requiredMonthly?: number;
  projectedFutureValue?: number;
  monthlyNetCashFlow?: number;
  updatedAt?: string;
};

export const EMPTY_PROFILE: CfoProfile = {
  goalName: "",
  goalAmount: "",
  months: "",
  currentSaved: "",
  incomeLow: "",
  incomeHigh: "",
  expenseLow: "",
  expenseHigh: "",
};

// Encrypted at rest via expo-secure-store (Keychain/Keystore). The profile holds
// personal financial figures (income, expenses, goal amounts), so it must not sit
// in plaintext AsyncStorage. SecureStore keys allow only [A-Za-z0-9._-] — hence the
// underscore form. LEGACY_KEY is the old plaintext AsyncStorage location; we migrate
// then purge it so no unencrypted copy lingers.
const STORAGE_KEY = "garzoni_cfo_profile_v1";
const LEGACY_KEY = "garzoni:cfo:profile:v1";

let cached: CfoProfile | null = null;
const listeners = new Set<(p: CfoProfile) => void>();

async function readStorage(): Promise<CfoProfile> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CfoProfile>;
      return { ...EMPTY_PROFILE, ...parsed };
    }
    // One-time migration off the old plaintext AsyncStorage store.
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      await AsyncStorage.removeItem(LEGACY_KEY);
      try {
        await SecureStore.setItemAsync(STORAGE_KEY, legacy);
      } catch (e) {
        logDevError("state/cfoProfile/migrate", e);
      }
      const parsed = JSON.parse(legacy) as Partial<CfoProfile>;
      return { ...EMPTY_PROFILE, ...parsed };
    }
    return EMPTY_PROFILE;
  } catch (e) {
    logDevError("state/cfoProfile/read", e);
    return EMPTY_PROFILE;
  }
}

export async function clearCfoProfileStorage(): Promise<void> {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch (e) {
    logDevError("state/cfoProfile/clear", e);
  }
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    /* legacy key may already be gone */
  }
  listeners.forEach((listener) => listener(EMPTY_PROFILE));
}

async function writeStorage(profile: CfoProfile): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    logDevError("state/cfoProfile/write", e);
  }
}

export function useCfoProfile(): {
  profile: CfoProfile;
  setProfile: (next: Partial<CfoProfile>) => void;
  hydrated: boolean;
} {
  const [profile, setProfileState] = useState<CfoProfile>(
    cached ?? EMPTY_PROFILE,
  );
  const [hydrated, setHydrated] = useState<boolean>(cached !== null);

  useEffect(() => {
    let cancelled = false;
    if (cached === null) {
      void (async () => {
        const next = await readStorage();
        if (cancelled) return;
        cached = next;
        setProfileState(next);
        setHydrated(true);
      })();
    }
    const listener = (next: CfoProfile) => setProfileState(next);
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  const setProfile = useCallback((next: Partial<CfoProfile>) => {
    const merged: CfoProfile = {
      ...(cached ?? EMPTY_PROFILE),
      ...next,
      updatedAt: new Date().toISOString(),
    };
    cached = merged;
    listeners.forEach((l) => l(merged));
    void writeStorage(merged);
  }, []);

  return { profile, setProfile, hydrated };
}

export function hasProfileInputs(profile: CfoProfile): boolean {
  return Boolean(
    profile.goalAmount ||
    profile.months ||
    profile.incomeLow ||
    profile.incomeHigh ||
    profile.expenseLow ||
    profile.expenseHigh ||
    profile.currentSaved ||
    profile.goalName,
  );
}
