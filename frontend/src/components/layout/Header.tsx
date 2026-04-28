import React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { MoonStarsFill, SunFill } from "react-bootstrap-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassContainer } from "components/ui";
import LanguageSelector from "components/common/LanguageSelector";
import { getMediaBaseUrl } from "services/backendUrl";
const VISIBLE_PATHS = new Set([
  "/",
  "/welcome",
  "/register",
  "/login",
  "/subscriptions",
  "/privacy-policy",
  "/cookie-policy",
  "/terms-of-service",
  "/financial-disclaimer",
  "/marketing",
  "/support",
]);

function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();
  const { isAuthenticated, isInitialized } = useAuth();
  const mediaBase = getMediaBaseUrl();
  const garzoniLogo = darkMode
    ? `${mediaBase}/media/logo/garzoni-logo-white-rectangular.png`
    : `${mediaBase}/media/logo/garzoni-logo-black-rectangular.png`;

  if (!VISIBLE_PATHS.has(location.pathname)) {
    return null;
  }

  const isLogin = location.pathname === "/login";
  const isRegister = location.pathname === "/register";

  const handleDarkModeToggle = () => {
    const nextDarkMode = !darkMode;
    toggleDarkMode(nextDarkMode);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-[1100] px-3 pt-2 sm:px-4 sm:pt-3">
      <GlassContainer
        variant="subtle"
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
            aria-label="Garzoni home"
            className="inline-flex items-center no-underline transition hover:opacity-90 hover:no-underline"
          >
            <img
              src={garzoniLogo}
              alt="Garzoni"
              className="relative top-0.5 h-12 w-auto object-contain sm:h-14 md:h-16 lg:h-20"
              loading="eager"
              decoding="async"
            />
          </Link>

          {isInitialized && isAuthenticated && (
            <span className="rounded-full bg-gradient-to-r from-[#2a7347] to-[#1d5330] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-md shadow-[#1d5330]/30 sm:px-3 sm:py-1 sm:text-[11px]">
              {t("header.premiumReady")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSelector />
          <button
            type="button"
            onClick={handleDarkModeToggle}
            aria-label={t("header.toggleDarkMode")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/35 text-content-muted shadow-sm transition hover:border-[color:var(--border-color,rgba(0,0,0,0.2))] hover:text-content-primary hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 sm:h-10 sm:w-10"
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
              {t("header.openDashboard")}
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
                  {t("header.login")}
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
                  {t("header.getStarted")}
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
