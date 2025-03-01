import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";

// Create context with default value
const ThemeContext = createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const cookieValue = Cookies.get("darkMode");
    return cookieValue ? cookieValue === "true" : false;
  });

  // Sync with backend on mount
  useEffect(() => {
    const fetchDarkMode = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
          { withCredentials: true }
        );
        if (response.data.dark_mode !== undefined) {
          setDarkMode(response.data.dark_mode);
          Cookies.set("darkMode", response.data.dark_mode.toString(), {
            expires: 365,
            sameSite: "strict",
          });
        }
      } catch (error) {
        console.error("Error fetching dark mode:", error);
      }
    };

    fetchDarkMode();
  }, []);

  const toggleDarkMode = (newValue) => {
    setDarkMode(newValue);
    Cookies.set("darkMode", newValue.toString(), {
      expires: 365,
      sameSite: "strict",
    });
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <div className={darkMode ? "dark-mode" : "light-mode"}>{children}</div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
