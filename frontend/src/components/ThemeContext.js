import React, { createContext, useState, useContext, useEffect } from "react";
import Cookies from "js-cookie";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check for stored preference in cookies when component mounts
    const storedDarkMode = Cookies.get("darkMode");
    const prefersDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // Set dark mode based on cookie value or user's system preference
    if (storedDarkMode !== undefined) {
      setDarkMode(storedDarkMode === "true");
    } else if (prefersDarkMode) {
      setDarkMode(true);
      Cookies.set("darkMode", "true", { expires: 365, sameSite: "strict" });
    }
  }, []);

  useEffect(() => {
    // Apply theme to document when darkMode changes
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [darkMode]);

  const toggleDarkMode = (value) => {
    setDarkMode(typeof value === "boolean" ? value : !darkMode);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
