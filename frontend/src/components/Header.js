import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "react-bootstrap";
import { MoonStarsFill, SunFill } from "react-bootstrap-icons";
import { useTheme } from "./ThemeContext";
import Cookies from "js-cookie";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();

  const showHeader = ["/", "/register", "/login"].includes(location.pathname);

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    toggleDarkMode(newDarkMode);
    Cookies.set("darkMode", newDarkMode.toString(), {
      expires: 365,
      sameSite: "strict",
    });
  };

  if (!showHeader) return null;

return (
    <header className="app-header">
        <div className="container-fluid">
            <div className="d-flex align-items-center justify-content-between w-100">
                <a href="/" className="app-header__brand">
                    <span className="app-header__text">monevo</span>
                </a>

                <div className="d-flex align-items-center gap-3">
                    <Button
                        variant="link"
                        onClick={handleDarkModeToggle}
                        className="p-0 text-secondary"
                        aria-label="Toggle dark mode"
                    >
                        {darkMode ? <SunFill size={20} /> : <MoonStarsFill size={20} />}
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate("/register")}
                        className="px-3"
                    >
                        Get Started
                    </Button>
                </div>
            </div>
        </div>
    </header>
);
}

export default Header;
