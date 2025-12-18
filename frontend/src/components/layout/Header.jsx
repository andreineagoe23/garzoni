import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { MoonStarsFill, SunFill } from "react-bootstrap-icons";
import Cookies from "js-cookie";
import { useTheme } from "contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassContainer } from "components/ui";

const VISIBLE_PATHS = new Set([
  "/",
  "/welcome",
  "/register",
  "/login",
  "/pricing",
]);

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();
  const { isAuthenticated, isInitialized } = useAuth();

  if (!VISIBLE_PATHS.has(location.pathname)) {
    return null;
  }

  const isWelcome =
    location.pathname === "/" || location.pathname === "/welcome";
  const isLogin = location.pathname === "/login";
  const isRegister = location.pathname === "/register";

  const handleDarkModeToggle = () => {
    const nextDarkMode = !darkMode;
    toggleDarkMode(nextDarkMode);
    Cookies.set("darkMode", nextDarkMode.toString(), {
      expires: 365,
      sameSite: "strict",
    });
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-[1100] px-3 pt-2 sm:px-4 sm:pt-3">
      <GlassContainer
        variant={isWelcome ? "subtle" : "default"}
        className={[
          "mx-auto flex h-[56px] w-full max-w-6xl items-center justify-between px-3 sm:h-[72px] sm:px-6",
          // Make it feel like glass immediately (especially on the Welcome page).
          "bg-[color:var(--card-bg,#ffffff)]/55",
          "border border-[color:var(--border-color,rgba(255,255,255,0.12))]",
        ].join(" ")}
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-[15px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-color,#111827)] no-underline transition hover:text-[color:var(--primary,#1d5330)] hover:no-underline sm:text-lg"
          >
            monevo
          </Link>

          {isInitialized && isAuthenticated && (
            <span className="rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30 sm:px-3 sm:py-1 sm:text-[11px]">
              Premium Ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDarkModeToggle}
            aria-label="Toggle dark mode"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/35 text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/45 hover:text-[color:var(--text-color,#111827)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/45 sm:h-10 sm:w-10"
          >
            {darkMode ? <SunFill size={18} /> : <MoonStarsFill size={18} />}
          </button>

          {isInitialized && isAuthenticated ? (
            <GlassButton
              type="button"
              onClick={() => navigate("/all-topics")}
              variant="active"
              size="sm"
              className="hidden sm:inline-flex sm:px-4 sm:py-2 sm:text-sm"
            >
              Open Dashboard
            </GlassButton>
          ) : (
            <>
              {!isLogin && (
                <GlassButton
                  type="button"
                  onClick={() => navigate("/login")}
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex sm:px-4 sm:py-2 sm:text-sm"
                >
                  Log in
                </GlassButton>
              )}
              {!isRegister && (
                <GlassButton
                  type="button"
                  onClick={() => navigate("/register")}
                  variant="active"
                  size="sm"
                  className="sm:px-4 sm:py-2 sm:text-sm"
                >
                  Get started
                </GlassButton>
              )}
            </>
          )}
        </div>
      </GlassContainer>
    </header>
  );
}

export default Header;
