import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MoonStarsFill, SunFill } from "react-bootstrap-icons";
import Cookies from "js-cookie";
import { useTheme } from "contexts/ThemeContext";

const VISIBLE_PATHS = new Set(["/", "/register", "/login"]);

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();

  if (!VISIBLE_PATHS.has(location.pathname)) {
    return null;
  }

  const handleDarkModeToggle = () => {
    const nextDarkMode = !darkMode;
    toggleDarkMode(nextDarkMode);
    Cookies.set("darkMode", nextDarkMode.toString(), {
      expires: 365,
      sameSite: "strict",
    });
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-[1100] border-b border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="mx-auto flex h-[70px] w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <a
          href="/"
          className="text-2xl font-semibold uppercase tracking-[0.2em] text-[color:var(--accent,#111827)]"
        >
          monevo
        </a>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDarkModeToggle}
            aria-label="Toggle dark mode"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            {darkMode ? <SunFill size={18} /> : <MoonStarsFill size={18} />}
          </button>

          <button
            type="button"
            onClick={() => navigate("/register")}
            className="inline-flex items-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-lg hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;

