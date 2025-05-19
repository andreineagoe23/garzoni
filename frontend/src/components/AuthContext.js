import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import axios from "axios";

const AuthContext = createContext();

// Access token is kept in memory only for better security
let inMemoryToken = null;

// Define backend URL - either from environment variable or hardcoded fallback
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000/api";

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [tokenRefreshInProgress, setTokenRefreshInProgress] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get the token from memory, not from localStorage
  const getAccessToken = () => inMemoryToken;

  // Login function that stores access token in memory only
  const loginUser = async (credentials) => {
    try {
      // Create a clean instance of axios without auth headers
      const loginInstance = axios.create();

      const response = await loginInstance.post(
        `${BACKEND_URL}/login-secure/`,
        credentials,
        { withCredentials: true }
      );

      console.log("Login successful, setting token");

      // Store only the access token in memory, refresh token is in HttpOnly cookie
      inMemoryToken = response.data.access;

      // Set authenticated state
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Force immediate update to headers for subsequent requests
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

      return { success: true };
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.error ||
          "Login failed. Please try again.",
      };
    }
  };

  // Register function that stores access token in memory only
  const registerUser = async (userData) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/register-secure/`,
        userData,
        { withCredentials: true }
      );

      // Store only the access token in memory, refresh token is in HttpOnly cookie
      inMemoryToken = response.data.access;

      // Set authenticated state
      setIsAuthenticated(true);
      setUser(response.data.user);

      return { success: true, next: response.data.next };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Registration failed",
      };
    }
  };

  // Function to refresh the token - wrapped in useCallback
  const refreshToken = useCallback(async () => {
    if (tokenRefreshInProgress || !isAuthenticated) return false;

    try {
      setTokenRefreshInProgress(true);
      console.log("Attempting to refresh token...");

      // Use the direct token refresh endpoint to avoid routing issues
      const refreshEndpoint = `${
        process.env.REACT_APP_BACKEND_URL || "http://localhost:8000"
      }/token/refresh/`;
      console.log("Using refresh endpoint:", refreshEndpoint);

      const response = await axios.post(
        refreshEndpoint,
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Token refresh successful");
      // Update the in-memory token
      inMemoryToken = response.data.access;
      setIsAuthenticated(true);

      // Update the default authorization header for all future requests
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

      return true;
    } catch (error) {
      // If refresh fails, logout
      console.error("Token refresh failed:", error);
      console.error("Response data:", error.response?.data);
      await logoutUser();
      return false;
    } finally {
      setTokenRefreshInProgress(false);
    }
  }, [tokenRefreshInProgress, isAuthenticated]);

  // Logout function that clears the token from memory and the cookie
  const logoutUser = async () => {
    try {
      // Only attempt to call logout endpoint if we have a token
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
      console.error("Logout API error:", error);
    } finally {
      // Clear in-memory token
      inMemoryToken = null;
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  // Check if we are authenticated on initial load
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        console.log("Verifying authentication...");
        const response = await axios.get(`${BACKEND_URL}/verify-auth/`, {
          withCredentials: true,
        });

        if (response.data.isAuthenticated) {
          console.log("User is authenticated:", response.data);
          inMemoryToken = response.data.access;
          setIsAuthenticated(true);
          setUser(response.data.user);
        } else {
          console.log("User is not authenticated");
        }
      } catch (error) {
        // Don't log the error for 401 responses as they're expected when not logged in
        if (error.response?.status !== 401) {
          console.error("Auth verification failed:", error);
        }
        // Clear any lingering state
        inMemoryToken = null;
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsInitialized(true);
      }
    };

    verifyAuth();
  }, []);

  // Add axios request interceptor
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        // Add token to headers if available
        const token = getAccessToken();
        if (token) {
          console.log("Adding auth token to request");
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add axios response interceptor
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle 401 Unauthorized errors by refreshing the token
        const originalRequest = error.config;

        // If the error is 401 and we haven't tried to refresh yet
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          isAuthenticated
        ) {
          originalRequest._retry = true;

          console.log("401 error detected, attempting to refresh token");

          try {
            // Try to refresh the token
            const refreshSuccess = await refreshToken();

            if (refreshSuccess) {
              console.log("Token refreshed successfully, retrying request");
              // Update the token in the failed request
              const newToken = getAccessToken();
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return axios(originalRequest);
            } else {
              console.log("Token refresh failed, rejecting request");
              return Promise.reject(error);
            }
          } catch (refreshError) {
            console.error("Error during token refresh:", refreshError);
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    // Cleanup interceptors
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [refreshToken, isAuthenticated]);

  // Don't render children until initial auth check is complete
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
