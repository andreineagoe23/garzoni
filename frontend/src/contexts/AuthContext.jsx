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
import { attachToken } from "services/httpClient";

// Always send cookies (refresh token) on cross-site requests
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

// Access token is kept in memory only for better security
let inMemoryToken = null;
const LOGOUT_FLAG_KEY = "monevo:manual-logout";
const REFRESH_STORAGE_KEY = "monevo:refresh-token";
const ACCESS_STORAGE_KEY = "monevo:access-token";
const ENTITLEMENT_SUPPORT_URL =
  "mailto:support@monevo.com?subject=Billing%20support";

const getLogoutFlag = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return sessionStorage.getItem(LOGOUT_FLAG_KEY) === "true";
};

const setLogoutFlag = (value) => {
  if (typeof window === "undefined") {
    return;
  }
  if (value) {
    sessionStorage.setItem(LOGOUT_FLAG_KEY, "true");
  } else {
    sessionStorage.removeItem(LOGOUT_FLAG_KEY);
  }
};

const getStoredRefreshToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return sessionStorage.getItem(REFRESH_STORAGE_KEY);
};

const setStoredRefreshToken = (token) => {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
  }
};

const getStoredAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return sessionStorage.getItem(ACCESS_STORAGE_KEY);
};

const setStoredAccessToken = (token) => {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    sessionStorage.setItem(ACCESS_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(ACCESS_STORAGE_KEY);
  }
};

// Rate limiting for token refresh
const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refresh attempts
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [entitlements, setEntitlements] = useState({
    plan: "free",
    entitled: false,
    fallback: false,
  });
  const [entitlementError, setEntitlementError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const isVerifying = useRef(false);
  const lastRefreshAttempt = useRef(0);
  const logoutFlagRef = useRef(getLogoutFlag());
  const inFlightRequestsRef = useRef(new Map());
  const profileRef = useRef(null);
  const settingsRef = useRef(null);
  const entitlementsRef = useRef(null);
  const didRequestInitialVerifyRef = useRef(false);

  const clearAuthState = useCallback(() => {
    inMemoryToken = null;
    setIsAuthenticated(false);
    setUser(null);
    setProfile(null);
    setSettings(null);
    setEntitlements({ plan: "free", entitled: false, fallback: false });
    setEntitlementError(null);
    profileRef.current = null;
    settingsRef.current = null;
    entitlementsRef.current = null;
    refreshAttempts = 0;
    delete axios.defaults.headers.common["Authorization"];
    inFlightRequestsRef.current.clear();
    setStoredRefreshToken(null);
    setStoredAccessToken(null);
  }, []);

  const getAccessToken = useCallback(() => inMemoryToken, []);

  const fetchUserWithToken = useCallback(async (token) => {
    if (!token) {
      console.info("[auth] fetchUserWithToken skipped: no token");
      return false;
    }

    console.info(
      "[auth] fetchUserWithToken using token",
      token.slice(0, 12),
      "..."
    );

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
        console.info("[auth] verify-auth success");
        return true;
      }
      console.warn("[auth] verify-auth returned unauthenticated payload");
      return false;
    } catch (userError) {
      if (userError.response?.status === 401) {
        console.warn("[auth] verify-auth 401");
        return { unauthorized: true };
      }
      console.error(
        "Failed to get user data after token refresh:",
        userError.response?.data || userError.message
      );
      return false;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (logoutFlagRef.current) {
      return { ok: false, reason: "logout-flag" };
    }

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

      const storedRefreshToken = getStoredRefreshToken();
      const response = await axios.post(
        `${BACKEND_URL}/token/refresh/`,
        storedRefreshToken ? { refresh: storedRefreshToken } : {},
        { withCredentials: true }
      );

      if (!response.data.access) {
        return false;
      }

      inMemoryToken = response.data.access;
      console.info(
        "[auth] new access token",
        inMemoryToken.slice(0, 12),
        "..."
      );
      setStoredAccessToken(inMemoryToken);
      if (response.data.refresh) {
        setStoredRefreshToken(response.data.refresh);
      }
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);
      logoutFlagRef.current = false;
      setLogoutFlag(false);
      console.info("[auth] refresh success");

      return { ok: true, token: inMemoryToken };
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.code;

      if (code === "user_not_found") {
        console.warn("[auth] refresh failed: user_not_found; clearing state");
        clearAuthState();
        setLogoutFlag(true);
        logoutFlagRef.current = true;
        return { ok: false, reason: "user-not-found" };
      }

      // Don't log 400 errors as they're expected when refresh token is invalid/expired
      // Only log unexpected errors
      if (status !== 400) {
        console.error(
          "Token refresh failed:",
          error.response?.data || error.message
        );
      }
      console.warn("[auth] refresh failed", status);
      return { ok: false, reason: "refresh-failed" };
    }
  }, [clearAuthState]);

  const verifyAuth = useCallback(async () => {
    if (isVerifying.current) return;

    const storedAccessToken = getStoredAccessToken();
    const storedRefreshToken = getStoredRefreshToken();
    const hasStoredTokens = !!storedRefreshToken || !!storedAccessToken;

    if (storedAccessToken && !inMemoryToken) {
      inMemoryToken = storedAccessToken;
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${storedAccessToken}`;
      attachToken(storedAccessToken);
    }

    // If we have neither a refresh token in storage nor an in-memory/access token, treat as logged out
    if (!hasStoredTokens && !inMemoryToken) {
      console.info("[auth] verifyAuth skipped: no tokens");
      clearAuthState();
      setIsInitialized(true);
      return;
    }

    if (logoutFlagRef.current && !hasStoredTokens) {
      clearAuthState();
      setIsInitialized(true);
      return;
    }

    try {
      isVerifying.current = true;
      console.info("[auth] verifyAuth start");
      const refreshed = await refreshToken();
      if (refreshed?.reason === "user-not-found") {
        clearAuthState();
        setIsInitialized(true);
        return;
      }

      if (refreshed?.ok) {
        // Assume authenticated on successful refresh; attempt to fetch user, but don't log out on a single verify failure
        setIsAuthenticated(true);
        const validated = await fetchUserWithToken(refreshed.token);
        if (validated === true) {
          return;
        }

        if (validated?.unauthorized) {
          console.warn(
            "[auth] verify-auth 401 after refresh; keeping session and will rely on next call/flow"
          );
          return;
        }

        // Non-401 fetch errors: keep session, they might be transient
        return;
      }

      console.warn("[auth] refresh did not succeed in verifyAuth", refreshed);
      clearAuthState();
    } catch (error) {
      console.error(
        "Auth verification failed:",
        error.response?.data || error.message
      );
      clearAuthState();
    } finally {
      setIsInitialized(true);
      isVerifying.current = false;
    }
  }, [clearAuthState, fetchUserWithToken, refreshToken]);

  const loginUser = async (credentials) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/login-secure/`,
        credentials,
        { withCredentials: true }
      );

      if (!response.data.access) {
        console.error("No access token in login response");
        throw new Error("No access token received");
      }

      inMemoryToken = response.data.access;
      setIsAuthenticated(true);
      setUser(response.data.user);
      setStoredRefreshToken(response.data.refresh);
      setStoredAccessToken(inMemoryToken);
      logoutFlagRef.current = false;
      setLogoutFlag(false);

      // Set the authorization header
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);

      return { success: true };
    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.message ||
          "Login failed. Please try again.",
      };
    }
  };

  const registerUser = async (userData) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/register-secure/`,
        userData,
        { withCredentials: true }
      );

      if (!response.data.access) {
        console.error("No access token in registration response");
        throw new Error("No access token received");
      }

      inMemoryToken = response.data.access;
      setIsAuthenticated(true);
      setUser(response.data.user);
      setStoredRefreshToken(response.data.refresh);
      setStoredAccessToken(inMemoryToken);
      logoutFlagRef.current = false;
      setLogoutFlag(false);

      // Set the authorization header
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);

      return { success: true, next: response.data.next };
    } catch (error) {
      console.error(
        "Registration failed:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error:
          error.response?.data?.error || error.message || "Registration failed",
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
      console.error("Logout failed:", error.response?.data || error.message);
    } finally {
      logoutFlagRef.current = true;
      setLogoutFlag(true);
      clearAuthState();
      attachToken(null);
    }
  };

  const cacheRequest = useCallback((key, fetcher, { force = false } = {}) => {
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
  }, []);

  const loadProfile = useCallback(
    async ({ force = false } = {}) => {
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

      profileRef.current = data;
      setProfile(data);
      return data;
    },
    [cacheRequest, isAuthenticated]
  );

  const loadSettings = useCallback(
    async ({ force = false } = {}) => {
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

      settingsRef.current = data;
      setSettings(data);
      return data;
    },
    [cacheRequest, isAuthenticated]
  );

  const loadEntitlements = useCallback(
    async ({ force = false } = {}) => {
      if (!isAuthenticated) {
        const fallbackEntitlements = {
          plan: "free",
          entitled: false,
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

        const normalized = {
          plan: data?.plan || "free",
          entitled: Boolean(data?.entitled),
          fallback: false,
          checked_at: data?.checked_at,
        };

        entitlementsRef.current = normalized;
        setEntitlements(normalized);
        setEntitlementError(null);
        return normalized;
      } catch (error) {
        const fallbackEntitlements = {
          plan: "free",
          entitled: false,
          fallback: true,
        };
        entitlementsRef.current = fallbackEntitlements;
        setEntitlements(fallbackEntitlements);
        setEntitlementError(
          error.response?.data?.error ||
            "We could not confirm your entitlements right now."
        );
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
    await loadProfile({ force: true });
  }, [loadProfile]);

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

          const storedRefreshToken = getStoredRefreshToken();
          if (!storedRefreshToken) {
            clearAuthState();
            return Promise.reject(error);
          }

          try {
            const refreshed = await refreshToken();
            if (refreshed?.ok) {
              originalRequest.headers.Authorization = `Bearer ${refreshed.token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            console.error(
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
    const storedAccess = getStoredAccessToken();
    if (storedAccess) {
      inMemoryToken = storedAccess;
      axios.defaults.headers.common["Authorization"] = `Bearer ${storedAccess}`;
      attachToken(storedAccess);
    }
    verifyAuth();
  }, [verifyAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEntitlements({ plan: "free", entitled: false, fallback: false });
      setEntitlementError(null);
      entitlementsRef.current = null;
      return;
    }

    loadEntitlements().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Failed to prefetch entitlements:", error);
    });
  }, [isAuthenticated, loadEntitlements]);

  if (!isInitialized) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        profile,
        settings,
        loginUser,
        registerUser,
        logoutUser,
        getAccessToken,
        isInitialized,
        loadProfile,
        refreshProfile,
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
