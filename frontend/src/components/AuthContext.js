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

  // Function to refresh the token - wrapped in useCallback
  const refreshToken = useCallback(async () => {
    if (tokenRefreshInProgress) return false;

    try {
      setTokenRefreshInProgress(true);
      console.log("Attempting to refresh token...");

      const response = await axios.post(
        `${BACKEND_URL}/token/refresh/`,
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
      console.error("Token refresh failed:", error);
      return false;
    } finally {
      setTokenRefreshInProgress(false);
    }
  }, [tokenRefreshInProgress]);

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

          // Set the authorization header
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${inMemoryToken}`;
        } else {
          console.log("User is not authenticated");
          // Try to refresh the token if we're not authenticated
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            inMemoryToken = null;
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Auth verification failed:", error);
        // Try to refresh the token on error
        const refreshSuccess = await refreshToken();
        if (!refreshSuccess) {
          inMemoryToken = null;
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        setIsInitialized(true);
      }
    };

    verifyAuth();
  }, [refreshToken]);

  // Add axios request interceptor
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        // Add token to headers if available
        const token = getAccessToken();
        if (token) {
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
        const originalRequest = error.config;

        // If the error is 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            const refreshSuccess = await refreshToken();

            if (refreshSuccess) {
              // Update the token in the failed request
              const newToken = getAccessToken();
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            console.error("Error during token refresh:", refreshError);
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
  }, [refreshToken]);

  // Login function that stores access token in memory only
  const loginUser = async (credentials) => {
    try {
      const response = await axios.post(
        `${BACKEND_URL}/login-secure/`,
        credentials,
        { withCredentials: true }
      );

      inMemoryToken = response.data.access;
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Set the authorization header
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

      return { success: true };
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);
      return {
        success: false,
        error:
          error.response?.data?.detail || "Login failed. Please try again.",
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

      inMemoryToken = response.data.access;
      setIsAuthenticated(true);
      setUser(response.data.user);

      // Set the authorization header
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${inMemoryToken}`;

      return { success: true, next: response.data.next };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Registration failed",
      };
    }
  };

  // Logout function that clears the token from memory and the cookie
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
      console.error("Logout API error:", error);
    } finally {
      inMemoryToken = null;
      setIsAuthenticated(false);
      setUser(null);
      delete axios.defaults.headers.common["Authorization"];
    }
  };

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
