import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import axios from "axios";

const AuthContext = createContext(null);

// Access token is kept in memory only for better security
let inMemoryToken = null;
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000/api";

// Rate limiting for token refresh
const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refresh attempts
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const isVerifying = useRef(false);
  const lastRefreshAttempt = useRef(0);

  const clearAuthState = () => {
    console.log("Clearing auth state");
    inMemoryToken = null;
    setIsAuthenticated(false);
    setUser(null);
    refreshAttempts = 0;
    delete axios.defaults.headers.common["Authorization"];
  };

  const refreshToken = async () => {
    const now = Date.now();
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN) {
      console.log("Refresh cooldown active");
      return false;
    }

    if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      console.error("Max refresh attempts reached");
      return false;
    }

    try {
      console.log("Attempting token refresh");
      lastRefreshAttempt.current = now;
      refreshAttempts++;

      const response = await axios.post(
        `${BACKEND_URL}/token/refresh/`,
        {},
        { withCredentials: true }
      );

      if (!response.data.access) {
        console.error("No access token in refresh response");
        return false;
      }

      console.log("Token refresh successful");
      inMemoryToken = response.data.access;
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

      // Verify user data with the new token
      const verify = await axios.get(`${BACKEND_URL}/verify-auth/`, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${inMemoryToken}`,
        },
      });

      setUser(verify.data.user);
      setIsAuthenticated(true);
      refreshAttempts = 0;
      return true;
    } catch (error) {
      console.error(
        "Token refresh failed:",
        error.response?.data || error.message
      );
      return false;
    }
  };

  const verifyAuth = useCallback(async () => {
    if (isVerifying.current) return;

    try {
      console.log("Starting auth verification");
      isVerifying.current = true;

      // Try to refresh token first
      const refreshed = await refreshToken();
      if (refreshed) {
        console.log("Auth verified via token refresh");
        return;
      }

      // If refresh failed, try direct verification as fallback
      try {
        console.log("Attempting direct verification");
        const verifyResponse = await axios.get(`${BACKEND_URL}/verify-auth/`, {
          withCredentials: true,
          headers: inMemoryToken
            ? {
                Authorization: `Bearer ${inMemoryToken}`,
              }
            : {},
        });

        if (verifyResponse.data.is_authenticated) {
          console.log("Auth verified directly");
          setIsAuthenticated(true);
          setUser(verifyResponse.data.user);
          return;
        }
      } catch (verifyError) {
        console.error(
          "Direct verification failed:",
          verifyError.response?.data || verifyError.message
        );
      }

      // If both refresh and verify failed, clear auth state
      console.log("All verification attempts failed");
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
  }, []);

  const loginUser = async (credentials) => {
    try {
      console.log("Attempting login");
      const response = await axios.post(
        `${BACKEND_URL}/login-secure/`,
        credentials,
        { withCredentials: true }
      );

      if (!response.data.access) {
        console.error("No access token in login response");
        throw new Error("No access token received");
      }

      console.log("Login successful");
      inMemoryToken = response.data.access;
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Set the authorization header
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

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
      console.log("Attempting registration");
      const response = await axios.post(
        `${BACKEND_URL}/register-secure/`,
        userData,
        { withCredentials: true }
      );

      if (!response.data.access) {
        console.error("No access token in registration response");
        throw new Error("No access token received");
      }

      console.log("Registration successful");
      inMemoryToken = response.data.access;
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Set the authorization header
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

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
      console.log("Attempting logout");
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
      clearAuthState();
    }
  };

  const getAccessToken = () => {
    return inMemoryToken;
  };

  // Set up axios interceptors
  axios.interceptors.request.use(
    (config) => {
      if (inMemoryToken) {
        config.headers.Authorization = `Bearer ${inMemoryToken}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        console.log("401 error detected, attempting token refresh");
        originalRequest._retry = true;

        try {
          const refreshed = await refreshToken();
          if (refreshed) {
            console.log("Token refreshed, retrying request");
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

  // Verify auth on mount
  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  if (!isInitialized) {
    return <div>Loading authentication...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loginUser,
        registerUser,
        logoutUser,
        getAccessToken,
        isInitialized,
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
