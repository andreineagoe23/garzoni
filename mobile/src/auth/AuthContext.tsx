import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DeviceEventEmitter } from "react-native";
import { attachToken } from "@garzoni/core";
import {
  clearGarzoniCustomerIo,
  identifyGarzoniUserFromAccessToken,
} from "../bootstrap/customerIoMobile";
import { tokenStorage } from "./tokenStorage";
import { markWelcomeHeaderPending } from "./firstRunFlags";
import {
  NATIVE_AUTH_STORAGE_CLEARED,
  resetNativeSessionStores,
} from "./nativeSessionReset";

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

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      NATIVE_AUTH_STORAGE_CLEARED,
      () => {
        setAccessToken(null);
      },
    );
    return () => sub.remove();
  }, []);

  const applyTokens = useCallback(async (access: string, refresh?: string) => {
    await tokenStorage.setAccess(access);
    if (refresh) await tokenStorage.setRefresh(refresh);
    attachToken(access);
    await markWelcomeHeaderPending();
    setAccessToken(access);
    void identifyGarzoniUserFromAccessToken(access);
  }, []);

  const clearSession = useCallback(async () => {
    await resetNativeSessionStores();
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
