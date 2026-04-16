import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { attachToken } from "@garzoni/core";
import { clearRevenueCatSession } from "../billing/subscriptionRuntime";
import {
  clearGarzoniCustomerIo,
  identifyGarzoniUserFromAccessToken,
} from "../bootstrap/customerIoMobile";
import { tokenStorage } from "./tokenStorage";
import { clearPlanChosenCache } from "./firstRunFlags";

type AuthSessionValue = {
  hydrated: boolean;
  accessToken: string | null;
  applyTokens: (access: string, refresh?: string) => Promise<void>;
  clearSession: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const access = await tokenStorage.getAccess();
      if (!cancelled && access) {
        attachToken(access);
        setAccessToken(access);
        void identifyGarzoniUserFromAccessToken(access);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTokens = useCallback(async (access: string, refresh?: string) => {
    await tokenStorage.setAccess(access);
    if (refresh) await tokenStorage.setRefresh(refresh);
    attachToken(access);
    setAccessToken(access);
    void identifyGarzoniUserFromAccessToken(access);
  }, []);

  const clearSession = useCallback(async () => {
    await clearGarzoniCustomerIo();
    await clearRevenueCatSession();
    await clearPlanChosenCache();
    await tokenStorage.clearAll();
    attachToken(null);
    setAccessToken(null);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      accessToken,
      applyTokens,
      clearSession,
    }),
    [hydrated, accessToken, applyTokens, clearSession],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthProvider");
  }
  return ctx;
}
