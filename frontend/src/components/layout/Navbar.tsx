import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MoonStarsFill, SunFill, BoxArrowRight } from "components/ui/icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import { GlassContainer } from "components/ui";
import LanguageSelector from "components/common/LanguageSelector";
import { UserProfile } from "types/api";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import { useTranslation } from "react-i18next";

const NAV_ITEMS = [
  { path: "/all-topics", key: "nav.dashboard", icon: "🏠", label: "Dashboard" },
  { path: "/exercises", key: "nav.exercises", icon: "💪", label: "Exercises" },
  { path: "/tools", key: "nav.tools", icon: "🛠️", label: "Tools" },
  { path: "/missions", key: "nav.missions", icon: "🎯", label: "Missions" },
  {
    path: "/leaderboards",
    key: "nav.leaderboards",
    icon: "🏆",
    label: "Leaderboards",
  },
  { path: "/rewards", key: "nav.rewards", icon: "🎁", label: "Rewards" },
  { path: "/support", key: "nav.support", icon: "❓", label: "Support" },
  { path: "/profile", key: "nav.profile", icon: "👤", label: "Profile" },
  { path: "/settings", key: "nav.settings", icon: "⚙️", label: "Settings" },
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { darkMode, toggleDarkMode } = useTheme();
  const {
    profile,
    user,
    loadProfile,
    logoutUser,
    isAuthenticated,
    isInitialized,
  } = useAuth();
  const { adminMode, canAdminister } = useAdmin();
  const navigate = useNavigate();

  const navItems = useMemo(
    () =>
      adminMode && canAdminister
        ? [
            ...NAV_ITEMS,
            {
              path: "/pricing-dashboard",
              key: "nav.conversions",
              icon: "📈",
              label: "Analytics",
            },
          ]
        : NAV_ITEMS,
    [adminMode, canAdminister]
  );

  useEffect(() => {
    const closeOnResize = () => {
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, []);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const createLinkClassName =
    (extraClasses = "") =>
    ({ isActive }) =>
      [
        "relative z-10 inline-flex h-7 items-center justify-center gap-1 rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 px-3 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] md:h-[36px] lg:h-[38px] xl:h-10",
        isActive
          ? "border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)] text-white shadow-md hover:bg-[color:var(--primary,#1d5330)]/90 focus:ring-[color:var(--primary,#1d5330)]/40"
          : "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:ring-[color:var(--primary,#1d5330)]/40",
        extraClasses,
      ]
        .filter(Boolean)
        .join(" ");

  const menuVisibility = menuOpen ? "flex" : "hidden";

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) {
      return;
    }
    if (!profile) {
      loadProfile().catch(() => undefined);
    }
  }, [isAuthenticated, isInitialized, loadProfile, profile]);

  const avatarSrc = useMemo(() => {
    const candidate =
      (profile as UserProfile)?.user_data?.profile_avatar ||
      (profile as UserProfile)?.user_data?.profile_avatar_url ||
      (profile as UserProfile)?.profile_avatar ||
      (profile as UserProfile)?.profile_avatar_url ||
      (profile as UserProfile)?.avatar ||
      (profile as UserProfile)?.avatar_url ||
      (user as UserProfile)?.profile_avatar ||
      (user as UserProfile)?.avatar ||
      (user as UserProfile)?.avatar_url;

    return String(candidate || DEFAULT_AVATAR_URL);
  }, [profile, user]);

  const handleDarkModeToggle = () => toggleDarkMode(!darkMode);

  const handleProfileClick = () => {
    navigate("/profile");
    closeMenu();
  };

  const handleLogoutClick = async () => {
    closeMenu();
    try {
      await logoutUser?.();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-[1200] px-3 transition-colors sm:px-4 lg:px-6 [--top-nav-height:56px] sm:[--top-nav-height:72px]"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        pointerEvents: "auto",
      }}
    >
      <div className="w-full pt-2 sm:pt-3">
        <GlassContainer
          variant="default"
          className="relative z-[1201] grid min-h-[56px] grid-cols-3 items-center gap-2 px-2 py-2 sm:min-h-[72px] sm:gap-4 sm:px-3 sm:py-3 md:gap-6 md:px-4"
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex items-center justify-start gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <NavLink
                to="/all-topics"
                onClick={closeMenu}
                className="relative z-10 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-color,#111827)] no-underline transition-all duration-300 ease-in-out hover:text-[color:var(--primary,#1d5330)] hover:no-underline touch-manipulation sm:text-sm md:text-base lg:text-lg xl:text-xl"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Monevo
              </NavLink>
            </div>
          </div>

          {/* Center: nav links on md+, utility icons on mobile */}
          <div className="hidden items-center justify-center md:flex">
            <div className="flex items-center justify-center gap-0.5 px-1 py-1 sm:gap-1 md:gap-1.5 lg:gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={createLinkClassName(
                    "relative z-10 no-underline hover:no-underline touch-manipulation"
                  )}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="hidden lg:inline">{t(item.key)}</span>
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:hidden">
            <LanguageSelector />
            <button
              type="button"
              onClick={handleDarkModeToggle}
              aria-label={t("nav.ariaToggleDarkMode")}
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {darkMode ? (
                <SunFill className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px]" />
              ) : (
                <MoonStarsFill className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px]" />
              )}
            </button>
            <button
              type="button"
              onClick={handleLogoutClick}
              aria-label={t("nav.ariaLogout")}
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <BoxArrowRight className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px]" />
            </button>
            <button
              type="button"
              onClick={handleProfileClick}
              aria-label={t("nav.ariaGoToProfile")}
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <img
                src={avatarSrc}
                alt={t("profile.avatarAlt")}
                className="h-full w-full object-cover"
                onError={(event) => {
                  if (event.currentTarget.src === DEFAULT_AVATAR_URL) {
                    return;
                  }
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_AVATAR_URL;
                }}
                referrerPolicy="no-referrer"
              />
            </button>
          </div>

          {/* Right: utility icons on md+, burger only on mobile */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
            <div className="hidden md:flex md:items-center md:gap-3 lg:gap-4">
              <LanguageSelector />
              <button
                type="button"
                onClick={handleDarkModeToggle}
                aria-label={t("nav.ariaToggleDarkMode")}
                className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px] md:h-[36px] md:w-[36px] lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10 2xl:h-11 2xl:w-11"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {darkMode ? (
                  <SunFill className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px] md:h-[16px] md:w-[16px] lg:h-[17px] lg:w-[17px] xl:h-[18px] xl:w-[18px] 2xl:h-5 2xl:w-5" />
                ) : (
                  <MoonStarsFill className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px] md:h-[16px] md:w-[16px] lg:h-[17px] lg:w-[17px] xl:h-[18px] xl:w-[18px] 2xl:h-5 2xl:w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleLogoutClick}
                aria-label={t("nav.ariaLogout")}
                className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px] md:h-[36px] md:w-[36px] lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10 2xl:h-11 2xl:w-11"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <BoxArrowRight className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px] md:h-[16px] md:w-[16px] lg:h-[17px] lg:w-[17px] xl:h-[18px] xl:w-[18px] 2xl:h-5 2xl:w-5" />
              </button>
              <button
                type="button"
                onClick={handleProfileClick}
                aria-label={t("nav.ariaGoToProfile")}
                className="relative z-10 inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px] md:h-[36px] md:w-[36px] lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10 2xl:h-11 2xl:w-11"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <img
                  src={avatarSrc}
                  alt={t("profile.avatarAlt")}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    if (event.currentTarget.src === DEFAULT_AVATAR_URL) {
                      return;
                    }
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                  referrerPolicy="no-referrer"
                />
              </button>
            </div>
            <button
              type="button"
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 md:hidden touch-manipulation sm:h-10 sm:w-10"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label={t("nav.ariaToggleMenu")}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <span className="block h-4 w-6 space-y-[6px]">
                <span
                  className={`block h-[2px] w-full rounded bg-current transition ${
                    menuOpen ? "translate-y-[6px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`block h-[2px] w-full rounded bg-current transition ${
                    menuOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`block h-[2px] w-full rounded bg-current transition ${
                    menuOpen ? "-translate-y-[6px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </GlassContainer>

        <GlassContainer
          variant="strong"
          className={`${menuVisibility} relative z-[1201] mt-3 flex-col gap-2 px-4 pb-4 pt-2 md:hidden`}
          style={{ pointerEvents: "auto" }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={createLinkClassName(
                "relative z-10 no-underline hover:no-underline touch-manipulation"
              )}
              onClick={closeMenu}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </GlassContainer>
      </div>
    </nav>
  );
}

export default Navbar;
