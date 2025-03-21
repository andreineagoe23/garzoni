import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() => {
    const tokens = localStorage.getItem("tokens");
    return tokens ? JSON.parse(tokens) : null;
  });

  const [user, setUser] = useState(null);

  const loginUser = async (credentials) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/login/`,
        credentials
      );

      localStorage.setItem(
        "tokens",
        JSON.stringify({
          access: response.data.access,
          refresh: response.data.refresh,
        })
      );

      setAuthTokens({
        access: response.data.access,
        refresh: response.data.refresh,
      });

      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "Login failed",
      };
    }
  };

  const registerUser = async (userData) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/register/`,
        userData
      );

      localStorage.setItem(
        "tokens",
        JSON.stringify({
          access: response.data.access,
          refresh: response.data.refresh,
        })
      );

      setAuthTokens({
        access: response.data.access,
        refresh: response.data.refresh,
      });

      setUser(response.data.user);
      return { success: true, next: response.data.next };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Registration failed",
      };
    }
  };

  const logoutUser = () => {
    localStorage.removeItem("tokens");
    setAuthTokens(null);
    setUser(null);
  };

  // Add axios request interceptor
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (authTokens?.access) {
          config.headers.Authorization = `Bearer ${authTokens.access}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, [authTokens]);

  return (
    <AuthContext.Provider
      value={{
        authTokens,
        user,
        loginUser,
        registerUser,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
