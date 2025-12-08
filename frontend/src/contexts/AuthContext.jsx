import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import axios from "axios";
import { attachToken } from "services/httpClient";

// Always send cookies (refresh token) on cross-site requests
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

// Access token is kept in memory only for better security
let inMemoryToken = null;
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000/api";
const LOGOUT_FLAG_KEY = "monevo:manual-logout";
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
  }, []);

  const getAccessToken = useCallback(() => inMemoryToken, []);

  const refreshToken = useCallback(async () => {
    if (logoutFlagRef.current) {
      return false;
    }

    const now = Date.now();
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN) {
      return false;
    }

    if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      return false;
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
        return false;
      }

      inMemoryToken = response.data.access;
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;
      attachToken(inMemoryToken);
      logoutFlagRef.current = false;
      setLogoutFlag(false);

      try {
        const userResponse = await axios.get(`${BACKEND_URL}/verify-auth/`, {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${inMemoryToken}`,
          },
        });

        if (userResponse.data.isAuthenticated) {
          setUser(userResponse.data.user);
          setIsAuthenticated(true);
          refreshAttempts = 0;
          return true;
        }
        return false;
      } catch (userError) {
        console.error(
          "Failed to get user data after token refresh:",
          userError
        );
        return false;
      }
    } catch (error) {
      console.error(
        "Token refresh failed:",
        error.response?.data || error.message
      );
      return false;
    }
  }, []);

  const verifyAuth = useCallback(async () => {
    if (isVerifying.current) return;

    try {
      isVerifying.current = true;
      const refreshed = await refreshToken();
      if (refreshed) {
        setIsAuthenticated(true);
        return;
      }

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
  }, [clearAuthState, refreshToken]);

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
          const response = await axios.get(
            `${BACKEND_URL}/userprofile/`,
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
          const response = await axios.get(
            `${BACKEND_URL}/user/settings/`,
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

          try {
            const refreshed = await refreshToken();
            if (refreshed) {
              originalRequest.headers.Authorization = `Bearer ${inMemoryToken}`;
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
