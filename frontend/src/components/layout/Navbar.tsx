import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  MoonStarsFill,
  SunFill,
  BoxArrowRight,
  ChevronDown,
} from "components/ui/icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import { GlassContainer } from "components/ui";
import LanguageSelector from "components/common/LanguageSelector";
import { UserProfile } from "types/api";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import { useTranslation } from "react-i18next";
import { MonevoIcon } from "components/ui/monevoIcons";

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
];

/** Dashboard spans both All Topics and Personalized Path routes. */
function isDashboardRoutePath(pathname: string) {
  return (
    pathname === "/all-topics" ||
    pathname === "/personalized-path" ||
    pathname.startsWith("/personalized-path/")
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileAccountButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileDropdownPortalRef = useRef<HTMLDivElement | null>(null);
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
  const location = useLocation();

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
      } else {
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener("resize", closeOnResize);
    return () => window.removeEventListener("resize", closeOnResize);
  }, []);

  useLayoutEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const updateDropdownPosition = () => {
      const btn = profileAccountButtonRef.current;
      const panel = profileDropdownPortalRef.current;
      if (!btn || !panel) {
        return;
      }
      const r = btn.getBoundingClientRect();
      panel.style.top = `${Math.round(r.bottom + 8)}px`;
      panel.style.right = `${Math.max(12, Math.round(window.innerWidth - r.right))}px`;
    };
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current?.contains(target)) {
        return;
      }
      if (profileDropdownPortalRef.current?.contains(target)) {
        return;
      }
      setProfileMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const createLinkClassName =
    (extraClasses = "") =>
    ({ isActive }) =>
      [
        "relative z-10 inline-flex h-7 items-center justify-center gap-1 rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 px-3 text-xs font-semibold text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] shadow-sm transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] md:h-[36px] lg:h-[38px] xl:h-10",
        isActive
          ? "border-[color:var(--color-brand-primary,var(--primary,#1d5330))] bg-[color:var(--color-brand-primary,var(--primary,#1d5330))] text-[color:var(--color-text-inverse,#ffffff)] shadow-md hover:border-[color:var(--color-brand-primary,var(--primary,#1d5330))] hover:bg-[color:var(--color-brand-primary,var(--primary,#1d5330))]/90 hover:text-[color:var(--color-text-inverse,#ffffff)] focus:ring-[color:var(--primary,#1d5330)]/40"
          : "border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.18)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 hover:text-[color:var(--color-text-primary,var(--text-color,#111827))] focus:ring-[color:var(--primary,#1d5330)]/40",
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
    setProfileMenuOpen(false);
  };

  const handleSettingsClick = () => {
    navigate("/settings");
    closeMenu();
    setProfileMenuOpen(false);
  };

  const handleLogoutClick = async () => {
    closeMenu();
    setProfileMenuOpen(false);
    try {
      await logoutUser?.();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const menuRowClass =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] transition-colors hover:bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.08)))] hover:text-[color:var(--color-text-primary,var(--text-color,#111827))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary,#1d5330)]/40";

  return (
    <nav
      className="app-navbar fixed left-0 right-0 top-0 z-[1200] px-3 transition-colors sm:px-4 lg:px-6 [--top-nav-height:56px] sm:[--top-nav-height:72px]"
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
          <div className="flex max-md:pl-2 items-center justify-start gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <NavLink
                to="/all-topics"
                onClick={closeMenu}
                className="app-navbar__brand relative z-10 text-[15px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-color,#111827)] no-underline transition hover:opacity-90 hover:no-underline touch-manipulation sm:text-lg"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Monevo
              </NavLink>
            </div>
          </div>

          {/* Center: nav links on md+, utility icons on mobile */}
          <div className="hidden items-center justify-center md:flex">
            <div className="flex items-center justify-center gap-0.5 px-1 py-1 sm:gap-1 md:gap-1.5 lg:gap-2">
              {navItems.map((item) => {
                const dashboardNavActive =
                  item.path === "/all-topics" &&
                  isDashboardRoutePath(location.pathname);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      createLinkClassName(
                        "relative z-10 no-underline hover:no-underline touch-manipulation"
                      )({ isActive: isActive || dashboardNavActive })
                    }
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    <MonevoIcon
                      name={item.icon}
                      size={16}
                      className="shrink-0 text-inherit"
                    />
                    <span className="hidden lg:inline">{t(item.key)}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:hidden">
            <LanguageSelector />
            <button
              type="button"
              onClick={handleDarkModeToggle}
              aria-label={t("nav.ariaToggleDarkMode")}
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.18)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 hover:text-[color:var(--color-text-primary,var(--text-color,#111827))] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {darkMode ? (
                <SunFill className="h-3.5 w-3.5 text-inherit transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px]" />
              ) : (
                <MoonStarsFill className="h-3.5 w-3.5 text-inherit transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px]" />
              )}
            </button>
            <button
              type="button"
              onClick={handleLogoutClick}
              aria-label={t("nav.ariaLogout")}
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.18)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 hover:text-[color:var(--color-text-primary,var(--text-color,#111827))] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px]"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <BoxArrowRight className="h-3.5 w-3.5 text-inherit transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px]" />
            </button>
            <button
              type="button"
              onClick={handleProfileClick}
              aria-label={t("nav.ariaGoToProfile")}
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.18)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px]"
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
          <div className="flex max-md:pr-2 items-center justify-end gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
            <div
              className="relative z-10 hidden md:block"
              ref={profileMenuRef}
            >
              <button
                ref={profileAccountButtonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-label={t("nav.ariaAccountMenu")}
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="relative z-10 inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.1)))] bg-[color:var(--color-surface-card,var(--card-bg,#ffffff))]/80 py-0.5 pl-0.5 pr-1.5 shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.18)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation md:pr-2"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.08)))] md:h-9 md:w-9 lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10">
                  <img
                    src={avatarSrc}
                    alt=""
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
                </span>
                <ChevronDown
                  aria-hidden
                  className={`h-3.5 w-3.5 shrink-0 text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] transition-transform duration-200 md:h-4 md:w-4 ${
                    profileMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {profileMenuOpen && typeof document !== "undefined"
                ? createPortal(
                    <div
                      ref={profileDropdownPortalRef}
                      className="fixed z-[1300] w-[min(100vw-1.5rem,260px)] [isolation:isolate]"
                    >
                      <GlassContainer
                        variant="default"
                        role="menu"
                        aria-label={t("nav.ariaAccountMenu")}
                        className="w-full rounded-2xl py-2"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className={menuRowClass}
                          onClick={handleProfileClick}
                        >
                          <MonevoIcon
                            name="👤"
                            size={18}
                            className="shrink-0 text-inherit"
                          />
                          {t("nav.profile")}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={menuRowClass}
                          onClick={handleSettingsClick}
                        >
                          <MonevoIcon
                            name="⚙️"
                            size={18}
                            className="shrink-0 text-inherit"
                          />
                          {t("nav.settings")}
                        </button>
                        <div
                          className="my-2 h-px bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.08)))]"
                          aria-hidden
                        />
                        <LanguageSelector variant="menuSection" />
                        <div
                          className="my-2 h-px bg-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.08)))]"
                          aria-hidden
                        />
                        <button
                          type="button"
                          role="menuitem"
                          className={menuRowClass}
                          onClick={handleDarkModeToggle}
                          aria-label={t("nav.ariaToggleDarkMode")}
                        >
                          {darkMode ? (
                            <SunFill className="h-[18px] w-[18px] shrink-0 text-inherit" />
                          ) : (
                            <MoonStarsFill className="h-[18px] w-[18px] shrink-0 text-inherit" />
                          )}
                          {t("header.toggleDarkMode")}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={menuRowClass}
                          onClick={handleLogoutClick}
                          aria-label={t("nav.ariaLogout")}
                        >
                          <BoxArrowRight className="h-[18px] w-[18px] shrink-0 text-inherit" />
                          {t("nav.ariaLogout")}
                        </button>
                      </GlassContainer>
                    </div>,
                    document.body
                  )
                : null}
            </div>
            <button
              type="button"
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--color-border-default,var(--border-color,#d1d5db))] text-[color:var(--color-icon-muted,var(--muted-text,#6b7280))] transition hover:border-[color:var(--color-border-default,var(--border-color,rgba(0,0,0,0.2)))] hover:bg-[color:var(--color-surface-elevated,var(--card-bg,#ffffff))]/90 hover:text-[color:var(--color-text-primary,var(--text-color,#111827))] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 md:hidden touch-manipulation sm:h-10 sm:w-10"
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
          {navItems.map((item) => {
            const dashboardNavActive =
              item.path === "/all-topics" &&
              isDashboardRoutePath(location.pathname);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  createLinkClassName(
                    "relative z-10 no-underline hover:no-underline touch-manipulation"
                  )({ isActive: isActive || dashboardNavActive })
                }
                onClick={closeMenu}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <MonevoIcon
                  name={item.icon}
                  size={16}
                  className="shrink-0 text-inherit"
                />
                <span>{t(item.key)}</span>
              </NavLink>
            );
          })}
        </GlassContainer>
      </div>
    </nav>
  );
}

export default Navbar;
