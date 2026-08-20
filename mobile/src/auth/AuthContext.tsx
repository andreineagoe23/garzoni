import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AppState,
  DeviceEventEmitter,
  type AppStateStatus,
} from "react-native";
import { attachToken } from "@garzoni/core";
import {
  clearGarzoniCustomerIo,
  identifyGarzoniUserFromAccessToken,
} from "../bootstrap/customerIoMobile";
import { fireAppOpenedDaily } from "../bootstrap/sessionTracking";
import { reregisterPushIfPermitted } from "../bootstrap/pushNotificationsMobile";
import { tokenStorage } from "./tokenStorage";
import { markWelcomeHeaderPending } from "./firstRunFlags";
import {
  bumpSessionVersion,
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
        // Daily app_opened event drives CIO inactivity segments. Debounced
        // to once per local day inside the helper.
        void fireAppOpenedDaily();
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

  // Emit (debounced) `app_opened` on every foreground while authed. Fires an
  // event, never a trait write — so CIO inactivity segments can use
  // "no app_opened event in last N days" without ever resetting on a passive
  // foreground bounce. The daily YMD gate in the helper guarantees one emit
  // per local day max.
  useEffect(() => {
    if (!accessToken) return;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        void fireAppOpenedDaily();
      }
    });
    return () => sub.remove();
  }, [accessToken]);

  const applyTokens = useCallback(async (access: string, refresh?: string) => {
    bumpSessionVersion();
    await tokenStorage.setAccess(access);
    if (refresh) await tokenStorage.setRefresh(refresh);
    attachToken(access);
    await markWelcomeHeaderPending();
    setAccessToken(access);
    // applyTokens fires only on a real authentication event (login or signup
    // returning fresh tokens), so it is the right place to stamp
    // last_active_at. Hydration on cold start passes no traits, leaving the
    // trait alone — inactivity segments must depend on real user actions, not
    // app presence.
    void (async () => {
      await identifyGarzoniUserFromAccessToken(access, {
        last_active_at: Math.floor(Date.now() / 1000),
      });
      // Re-attach the push device to this freshly-identified profile so CIO
      // doesn't end up with "No devices synced". No-op / no prompt if push
      // permission was never granted.
      await reregisterPushIfPermitted();
    })();
    // A fresh login is also an app open — fire the event so today's
    // engagement is captured even if hydration ran in a different session.
    void fireAppOpenedDaily();
  }, []);

  const clearSession = useCallback(async () => {
    // Disable queries immediately so no enabled:hasSession query re-fetches mid
    // cleanup. We intentionally KEEP the access token attached here: the first
    // thing resetNativeSessionStores does is clearExpoPushToken() — an
    // authenticated POST that must carry the Bearer header, or the server never
    // drops the push token and the request 401s. resetNativeSessionStores
    // detaches the token itself once the server-side clear has run.
    setAccessToken(null);
    await resetNativeSessionStores();
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
