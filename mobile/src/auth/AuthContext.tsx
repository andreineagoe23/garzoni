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

const AUTH_NOT_READY: AuthSessionValue = {
  hydrated: false,
  accessToken: null,
  applyTokens: async () => {},
  clearSession: async () => {},
};

export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  // Return a safe "not ready" default when rendered outside the provider.
  // Expo Router can pre-render the initial route before the layout mounts,
  // so the provider may genuinely not be present on the very first render.
  return ctx ?? AUTH_NOT_READY;
}
