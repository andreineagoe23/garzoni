import React, { createContext, useState, useContext, useEffect } from "react";
import Cookies from "js-cookie";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const storedDarkMode = Cookies.get("darkMode");
    return storedDarkMode === "true";
  });

  useEffect(() => {
    // Apply theme to document when darkMode changes
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
