import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type ThemeContextValue = {
  darkMode: boolean;
  toggleDarkMode: (value?: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "monevo:theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return stored === "dark";
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [darkMode, setDarkMode] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, darkMode ? "dark" : "light");
    } catch (_) {
      // Ignore storage errors (private mode)
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(
    (value?: boolean) => {
      setDarkMode(typeof value === "boolean" ? value : !darkMode);
    },
    [darkMode]
  );

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
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

export default ThemeContext;
