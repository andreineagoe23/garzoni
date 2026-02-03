import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import axios from "axios";
import { BACKEND_URL } from "services/backendUrl";
import { EntitlementFeature } from "types/api";
import { attachToken } from "services/httpClient";
import { queryClient, queryKeys } from "lib/reactQuery";
import type { Entitlements, FinancialProfile, UserProfile } from "types/api";

type ApiErrorResponse = {
  response?: {
    data?: {
      detail?: string;
      error?: string;
    };
    detail?: string;
    error?: string;
  };
  message?: string;
};

// Always send cookies (refresh token) on cross-site requests
axios.defaults.withCredentials = true;

type AuthContextValue = {
  isAuthenticated: boolean;
  user: UserProfile | null;
  profile: UserProfile | null;
  financialProfile: FinancialProfile | null;
  settings: Record<string, unknown> | null;
  loginUser: (
    credentials: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  registerUser: (userData: Record<string, unknown>) => Promise<{
    success: boolean;
    error?: string;
    user?: UserProfile;
    next?: string;
  }>;
  logoutUser: () => Promise<void>;
  getAccessToken: () => string | null;
  isInitialized: boolean;
  loadProfile: (options?: { force?: boolean }) => Promise<UserProfile | null>;
  refreshProfile: () => Promise<void>;
  loadFinancialProfile: (options?: {
    force?: boolean;
  }) => Promise<FinancialProfile | null>;
  updateFinancialProfile: (
    data: Partial<FinancialProfile>
  ) => Promise<FinancialProfile | null>;
  loadSettings: (options?: {
    force?: boolean;
  }) => Promise<Record<string, unknown> | null>;
  loadEntitlements: (options?: { force?: boolean }) => Promise<Entitlements>;
  reloadEntitlements: () => Promise<Entitlements>;
  entitlements: Entitlements;
  entitlementError: string | null;
  entitlementSupportLink: string;
};

type FetchUserResult = true | false | { unauthorized: true };
type RefreshResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Access token is kept in memory; sessionStorage is used to survive full reloads.
let inMemoryToken: string | null = null;
const ACCESS_TOKEN_STORAGE_KEY = "monevo_access_token";
const REFRESH_SESSION_KEY = "monevo_has_refresh_session";
const ENTITLEMENT_SUPPORT_URL =
  "mailto:support@monevo.com?subject=Billing%20support";
const isDevelopment = process.env.NODE_ENV === "development";
const authLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.info(...args);
  }
};
const authWarn = (...args: unknown[]) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};
const authError = (...args: unknown[]) => {
  console.error(...args);
};

// Rate limiting for token refresh
const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refresh attempts
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [financialProfile, setFinancialProfile] =
    useState<FinancialProfile | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(
    null
  );
  const [entitlements, setEntitlements] = useState<Entitlements>({
    plan: "free",
    label: null,
    entitled: false,
    status: null,
    trialEnd: null,
    features: {},
    subscription: null,
    fallback: false,
  });
  const [entitlementError, setEntitlementError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const isVerifying = useRef(false);
  const lastRefreshAttempt = useRef(0);
  const inFlightRequestsRef = useRef(new Map<string, Promise<unknown>>());
  const profileRef = useRef<UserProfile | null>(null);
  const financialProfileRef = useRef<FinancialProfile | null>(null);
  const settingsRef = useRef<Record<string, unknown> | null>(null);
  const entitlementsRef = useRef<Entitlements | null>(null);
  const didRequestInitialVerifyRef = useRef(false);

  const clearAuthState = useCallback(() => {
    inMemoryToken = null;
    sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_SESSION_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setProfile(null);
    setFinancialProfile(null);
    setSettings(null);
    setEntitlements({
      plan: "free",
      label: null,
      entitled: false,
      status: null,
      trialEnd: null,
      features: {},
      subscription: null,
      fallback: false,
    });
    setEntitlementError(null);
    profileRef.current = null;
    financialProfileRef.current = null;
    settingsRef.current = null;
    entitlementsRef.current = null;
    refreshAttempts = 0;
    delete axios.defaults.headers.common["Authorization"];
    inFlightRequestsRef.current.clear();
    queryClient.removeQueries({ queryKey: queryKeys.profile() });
    queryClient.removeQueries({ queryKey: queryKeys.entitlements() });
  }, []);

  const getAccessToken = useCallback(() => inMemoryToken, []);

  const persistAccessToken = useCallback((token: string) => {
    if (!token) return;
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(REFRESH_SESSION_KEY, "1");
  }, []);

  const restoreAccessToken = useCallback(() => {
    if (inMemoryToken) return inMemoryToken;
    const stored = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (stored) {
      inMemoryToken = stored;
      axios.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
      attachToken(stored);
      return stored;
    }
    return null;
  }, []);

  const hasRefreshSession = useCallback(() => {
    return sessionStorage.getItem(REFRESH_SESSION_KEY) === "1";
  }, []);

  const fetchUserWithToken = useCallback(
    async (token: string | null): Promise<FetchUserResult> => {
      if (!token) {
        authLog("[auth] fetchUserWithToken skipped: no token");
        return false;
      }

      authLog("[auth] fetchUserWithToken using token");

      try {
        const userResponse = await axios.get(`${BACKEND_URL}/verify-auth/`, {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (userResponse.data.isAuthenticated) {
          setUser(userResponse.data.user);
          setIsAuthenticated(true);
          refreshAttempts = 0;
          authLog("[auth] verify-auth success");
          return true;
        }
        authWarn("[auth] verify-auth returned unauthenticated payload");
        return false;
      } catch (userError) {
        if (userError.response?.status === 401) {
          authWarn("[auth] verify-auth 401");
          return { unauthorized: true };
        }
        authError(
          "Failed to get user data after token refresh:",
          userError.response?.data || userError.message
        );
        return false;
      }
    },
    []
  );

  const refreshToken = useCallback(async (): Promise<RefreshResult> => {
    const now = Date.now();
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN) {
      return { ok: false, reason: "cooldown" };
    }

    if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      return { ok: false, reason: "max-attempts" };
    }

    try {
      lastRefreshAttempt.current = now;
      refreshAttempts++;

      const response = await axios.post(
        `${BACKEND_URL}/token/refresh/`,
        {},
        { withCredentials: true }
      );

      if (!response.data.access) {
        return { ok: false, reason: "no-access" };
      }

      inMemoryToken = response.data.access;
      persistAccessToken(inMemoryToken);
      authLog("[auth] new access token received");
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);
      authLog("[auth] refresh success");

      return { ok: true, token: inMemoryToken };
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.code;

      if (code === "user_not_found") {
        authWarn("[auth] refresh failed: user_not_found; clearing state");
        clearAuthState();
        return { ok: false, reason: "user-not-found" };
      }

      // Don't log 400 errors as they're expected when refresh token is invalid/expired
      // Only log unexpected errors
      if (status !== 400) {
        authError(
          "Token refresh failed:",
          error.response?.data || error.message
        );
      }
      authWarn("[auth] refresh failed", status);
      return { ok: false, reason: "refresh-failed" };
    }
  }, [clearAuthState, persistAccessToken]);

  const verifyAuth = useCallback(async () => {
    if (isVerifying.current) return;

    try {
      isVerifying.current = true;
      authLog("[auth] verifyAuth start");
      const restored = restoreAccessToken();
      if (restored) {
        const validated = await fetchUserWithToken(restored);
        if (validated === true) {
          setIsAuthenticated(true);
          setIsInitialized(true);
          return;
        }
      }
      if (!hasRefreshSession()) {
        authLog("[auth] verifyAuth skipped: no refresh session");
        setIsInitialized(true);
        return;
      }
      const refreshed = await refreshToken();
      if (
        !refreshed.ok &&
        "reason" in refreshed &&
        refreshed.reason === "user-not-found"
      ) {
        clearAuthState();
        setIsInitialized(true);
        return;
      }

      if (refreshed.ok) {
        // Assume authenticated on successful refresh; attempt to fetch user, but don't log out on a single verify failure
        setIsAuthenticated(true);
        const validated = await fetchUserWithToken(refreshed.token);
        if (validated === true) {
          return;
        }

        if (
          validated &&
          typeof validated === "object" &&
          "unauthorized" in validated
        ) {
          authWarn(
            "[auth] verify-auth 401 after refresh; keeping session and will rely on next call/flow"
          );
          return;
        }

        // Non-401 fetch errors: keep session, they might be transient
        return;
      }

      authWarn("[auth] refresh did not succeed in verifyAuth", refreshed);
      clearAuthState();
    } catch (error) {
      authError(
        "Auth verification failed:",
        error.response?.data || error.message
      );
      clearAuthState();
    } finally {
      setIsInitialized(true);
      isVerifying.current = false;
    }
  }, [
    clearAuthState,
    fetchUserWithToken,
    refreshToken,
    restoreAccessToken,
    hasRefreshSession,
  ]);

  const loginUser = async (credentials: Record<string, unknown>) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/login-secure/`,
        credentials,
        { withCredentials: true }
      );

      if (!response.data.access) {
        authError("No access token in login response");
        throw new Error("No access token received");
      }

      inMemoryToken = response.data.access;
      persistAccessToken(inMemoryToken);
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Set the authorization header
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);

      return { success: true, user: response.data.user as UserProfile };
    } catch (error) {
      const errorObj = error as ApiErrorResponse;
      authError("Login failed:", errorObj.response?.data || errorObj.message);
      return {
        success: false,
        error:
          errorObj.response?.data?.detail ||
          errorObj.response?.data?.error ||
          errorObj.message ||
          "Login failed. Please try again.",
      };
    }
  };

  const registerUser = async (userData: Record<string, unknown>) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/register-secure/`,
        userData,
        { withCredentials: true }
      );

      if (!response.data.access) {
        authError("No access token in registration response");
        throw new Error("No access token received");
      }

      inMemoryToken = response.data.access;
      persistAccessToken(inMemoryToken);
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Set the authorization header
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);

      return {
        success: true,
        user: response.data.user as UserProfile,
        next: response.data.next,
      };
    } catch (error) {
      const errorObj = error as ApiErrorResponse;
      authError(
        "Registration failed:",
        errorObj.response?.data || errorObj.message
      );
      return {
        success: false,
        error:
          errorObj.response?.data?.error ||
          errorObj.response?.data?.detail ||
          errorObj.message ||
          "Registration failed",
      };
    }
  };

  const logoutUser = async () => {
    try {
      if (inMemoryToken) {
        await axios.post(
          `${BACKEND_URL}/logout/`,
          {},
          {
            withCredentials: true,
            headers: { Authorization: `Bearer ${inMemoryToken}` },
          }
        );
      }
    } catch (error) {
      authError("Logout failed:", error.response?.data || error.message);
    } finally {
      clearAuthState();
      attachToken(null);
    }
  };

  const cacheRequest = useCallback(
    (
      key: string,
      fetcher: () => Promise<unknown>,
      { force = false }: { force?: boolean } = {}
    ) => {
      const runFetch = () => {
        const requestPromise = (async () => {
          try {
            return await fetcher();
          } finally {
            inFlightRequestsRef.current.delete(key);
          }
        })();

        inFlightRequestsRef.current.set(key, requestPromise);
        return requestPromise;
      };

      if (force) {
        const existing = inFlightRequestsRef.current.get(key);
        if (existing) {
          return existing.then(() => runFetch());
        }
        return runFetch();
      }

      const existing = inFlightRequestsRef.current.get(key);
      if (existing) {
        return existing;
      }

      return runFetch();
    },
    []
  );

  const loadProfile = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!isAuthenticated) return null;

      if (!force && profileRef.current) {
        return profileRef.current;
      }

      const data = await cacheRequest(
        "profile",
        async () => {
          const response = await axios.get(`${BACKEND_URL}/userprofile/`, {
            headers: {
              Authorization: `Bearer ${inMemoryToken}`,
            },
          });
          return response.data;
        },
        { force }
      );

      const profileData = data as UserProfile;
      profileRef.current = profileData;
      setProfile(profileData);
      const embeddedFinancial =
        (profileData?.user_data as { financial_profile?: FinancialProfile } | undefined)
          ?.financial_profile ?? null;
      if (embeddedFinancial && !financialProfileRef.current) {
        financialProfileRef.current = embeddedFinancial;
        setFinancialProfile(embeddedFinancial);
      }
      queryClient.setQueryData(queryKeys.profile(), profileData);
      return profileData;
    },
    [cacheRequest, isAuthenticated]
  );

  const loadFinancialProfile = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!isAuthenticated) return null;
      if (!force && financialProfileRef.current) {
        return financialProfileRef.current;
      }
      const data = await cacheRequest(
        "financial-profile",
        async () => {
          const response = await axios.get(`${BACKEND_URL}/me/profile/`, {
            headers: { Authorization: `Bearer ${inMemoryToken}` },
          });
          return response.data;
        },
        { force }
      );
      financialProfileRef.current = data as FinancialProfile;
      setFinancialProfile(data as FinancialProfile);
      return data as FinancialProfile;
    },
    [cacheRequest, isAuthenticated]
  );

  const updateFinancialProfile = useCallback(
    async (data: Partial<FinancialProfile>) => {
      if (!isAuthenticated) return null;
      const response = await axios.put(`${BACKEND_URL}/me/profile/`, data, {
        headers: { Authorization: `Bearer ${inMemoryToken}` },
      });
      financialProfileRef.current = response.data;
      setFinancialProfile(response.data);
      return response.data;
    },
    [isAuthenticated]
  );

  const loadSettings = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!isAuthenticated) return null;

      if (!force && settingsRef.current) {
        return settingsRef.current;
      }

      const data = await cacheRequest(
        "settings",
        async () => {
          const response = await axios.get(`${BACKEND_URL}/user/settings/`, {
            headers: {
              Authorization: `Bearer ${inMemoryToken}`,
            },
          });
          return response.data;
        },
        { force }
      );

      const settingsData = data as Record<string, unknown>;
      settingsRef.current = settingsData;
      setSettings(settingsData);
      return settingsData;
    },
    [cacheRequest, isAuthenticated]
  );

  const loadEntitlements = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!isAuthenticated) {
        const fallbackEntitlements = {
          plan: "free",
          label: null,
          entitled: false,
          status: null,
          trialEnd: null,
          features: {},
          subscription: null,
          fallback: false,
        };
        entitlementsRef.current = fallbackEntitlements;
        setEntitlements(fallbackEntitlements);
        setEntitlementError(null);
        return fallbackEntitlements;
      }

      if (!force && entitlementsRef.current) {
        return entitlementsRef.current;
      }

      try {
        const data = await cacheRequest(
          "entitlements",
          async () => {
            const response = await axios.get(
              `${BACKEND_URL}/finance/entitlements/`,
              {
                headers: {
                  Authorization: `Bearer ${inMemoryToken}`,
                },
              }
            );
            return response.data;
          },
          { force }
        );

        const dataObj = data as Partial<Entitlements> & {
          subscription?: { status?: string; trial_end?: string };
        };
        const normalized: Entitlements = {
          plan: dataObj?.plan || "free",
          label: dataObj?.label || null,
          entitled: Boolean(dataObj?.entitled),
          status:
            dataObj?.subscription?.status ||
            (dataObj?.status as string | null) ||
            null,
          trialEnd:
            dataObj?.subscription?.trial_end || dataObj?.trial_end || null,
          features:
            (dataObj?.features as Record<string, EntitlementFeature>) || {},
          subscription:
            (dataObj?.subscription as Record<string, unknown>) || null,
          fallback: false,
          checked_at: dataObj?.checked_at,
        };

        entitlementsRef.current = normalized;
        setEntitlements(normalized);
        setEntitlementError(null);
        queryClient.setQueryData(queryKeys.entitlements(), {
          data: normalized,
        });
        return normalized;
      } catch (error) {
        const fallbackEntitlements: Entitlements = {
          plan: "free",
          label: null,
          entitled: false,
          status: null,
          trialEnd: null,
          features: {},
          subscription: null,
          fallback: true,
        };
        entitlementsRef.current = fallbackEntitlements;
        setEntitlements(fallbackEntitlements);
        setEntitlementError(
          error.response?.data?.error ||
            "We could not confirm your entitlements right now."
        );
        queryClient.setQueryData(queryKeys.entitlements(), {
          data: fallbackEntitlements,
        });
        return fallbackEntitlements;
      }
    },
    [cacheRequest, isAuthenticated]
  );

  const reloadEntitlements = useCallback(
    () => loadEntitlements({ force: true }),
    [loadEntitlements]
  );

  const refreshProfile = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    await loadProfile({ force: true });
    await loadFinancialProfile({ force: true });
  }, [loadFinancialProfile, loadProfile]);

  useEffect(() => {
    const requestId = axios.interceptors.request.use(
      (config) => {
        if (inMemoryToken) {
          config.headers.Authorization = `Bearer ${inMemoryToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshed = await refreshToken();
            if (refreshed.ok) {
              originalRequest.headers.Authorization = `Bearer ${refreshed.token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            authError(
              "Token refresh failed in interceptor:",
              refreshError.response?.data || refreshError.message
            );
          }

          clearAuthState();
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestId);
      axios.interceptors.response.eject(responseId);
    };
  }, [clearAuthState, refreshToken]);

  // Verify auth on mount
  useEffect(() => {
    if (didRequestInitialVerifyRef.current) {
      return;
    }
    didRequestInitialVerifyRef.current = true;
    verifyAuth();
  }, [verifyAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEntitlements({
        plan: "free",
        label: null,
        entitled: false,
        status: null,
        trialEnd: null,
        features: {},
        subscription: null,
        fallback: false,
      });
      setEntitlementError(null);
      entitlementsRef.current = null;
      financialProfileRef.current = null;
      setFinancialProfile(null);
      return;
    }

    loadEntitlements().catch((error) => {
      authError("Failed to prefetch entitlements:", error);
    });
    loadFinancialProfile().catch((error) => {
      authError("Failed to prefetch financial profile:", error);
    });
  }, [isAuthenticated, loadEntitlements, loadFinancialProfile]);

  if (!isInitialized) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        profile,
        financialProfile,
        settings,
        loginUser,
        registerUser,
        logoutUser,
        getAccessToken,
        isInitialized,
        loadProfile,
        refreshProfile,
        loadFinancialProfile,
        updateFinancialProfile,
        loadSettings,
        loadEntitlements,
        reloadEntitlements,
        entitlements,
        entitlementError,
        entitlementSupportLink: ENTITLEMENT_SUPPORT_URL,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
