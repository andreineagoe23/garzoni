import React, { createContext, useState, useContext, useEffect } from "react";
import Cookies from "js-cookie";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Default to dark mode (true) if no cookie is set
  const [darkMode, setDarkMode] = useState(() => {
    const storedDarkMode = Cookies.get("darkMode");
    // If no cookie exists, default to dark mode
    if (storedDarkMode === undefined || storedDarkMode === null) {
      return true;
    }
    return storedDarkMode === "true";
  });

  // Apply theme immediately on mount to prevent flash of light mode
  useEffect(() => {
    const applyTheme = () => {
      const storedDarkMode = Cookies.get("darkMode");
      const shouldBeDark = storedDarkMode === undefined || storedDarkMode === null || storedDarkMode === "true";

      if (shouldBeDark) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    };

    // Apply theme immediately
    applyTheme();

    // Update theme when darkMode state changes
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    // Save to cookie
    Cookies.set("darkMode", darkMode.toString(), {
      expires: 365,
      sameSite: "strict",
    });
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
