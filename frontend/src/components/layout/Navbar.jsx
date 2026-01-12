import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MoonStarsFill, SunFill, BoxArrowRight } from "react-bootstrap-icons";
import { useTheme } from "contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import { GlassContainer } from "components/ui";

const NAV_ITEMS = [
  { path: "/all-topics", label: "Dashboard", icon: "🏠" },
  { path: "/exercises", label: "Exercises", icon: "💪" },
  { path: "/tools", label: "Tools", icon: "🛠️" },
  { path: "/missions", label: "Missions", icon: "🎯" },
  { path: "/leaderboards", label: "Leaderboards", icon: "🏆" },
  { path: "/rewards", label: "Rewards", icon: "🎁" },
  { path: "/faq", label: "FAQ", icon: "❓" },
  { path: "/profile", label: "Profile", icon: "👤" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
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
            { path: "/pricing-dashboard", label: "Conversions", icon: "📈" },
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
        "inline-flex items-center justify-center gap-0.5 rounded-full font-semibold transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-2 py-1 text-[10px] sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-[11px] md:gap-1.5 md:px-3 md:py-1.5 md:text-xs lg:gap-2 lg:px-3.5 lg:py-2 lg:text-sm xl:px-4 xl:py-2.5",
        isActive
          ? "bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:ring-[color:var(--primary,#1d5330)]/40"
          : "border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 text-[color:var(--text-color,#111827)] hover:border-[color:var(--primary,#1d5330)]/60 hover:bg-[color:var(--primary,#1d5330)]/10 hover:text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]/40",
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
      loadProfile().catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load profile for navbar avatar:", error);
      });
    }
  }, [isAuthenticated, isInitialized, loadProfile, profile]);

  const avatarSrc = useMemo(() => {
    const candidate =
      profile?.user_data?.profile_avatar ||
      profile?.user_data?.profile_avatar_url ||
      profile?.profile_avatar ||
      profile?.profile_avatar_url ||
      profile?.avatar ||
      profile?.avatar_url ||
      user?.profile_avatar ||
      user?.avatar ||
      user?.avatar_url;

    return candidate || "/default-avatar.png";
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
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
            <button
              type="button"
              onClick={handleDarkModeToggle}
              aria-label="Toggle dark mode"
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
              aria-label="Logout"
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px] md:h-[36px] md:w-[36px] lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10 2xl:h-11 2xl:w-11"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <BoxArrowRight className="h-3.5 w-3.5 transition-all duration-300 ease-in-out sm:h-[15px] sm:w-[15px] md:h-[16px] md:w-[16px] lg:h-[17px] lg:w-[17px] xl:h-[18px] xl:w-[18px] 2xl:h-5 2xl:w-5" />
            </button>

            <button
              type="button"
              onClick={handleProfileClick}
              aria-label="Go to profile"
              className="relative z-10 inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 shadow-sm transition-all duration-300 ease-in-out hover:border-[color:var(--primary,#1d5330)]/40 hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-[34px] sm:w-[34px] md:h-[36px] md:w-[36px] lg:h-[38px] lg:w-[38px] xl:h-10 xl:w-10 2xl:h-11 2xl:w-11"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <img
                src={avatarSrc}
                alt={
                  user?.username ? `${user.username} avatar` : "Profile avatar"
                }
                className="h-full w-full object-cover"
                onError={(event) => {
                  if (event.currentTarget.src.includes("/default-avatar.png")) {
                    return;
                  }
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = "/default-avatar.png";
                }}
                referrerPolicy="no-referrer"
              />
            </button>

            <button
              type="button"
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 md:hidden touch-manipulation sm:h-10 sm:w-10"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
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
              <span>{item.label}</span>
            </NavLink>
          ))}
        </GlassContainer>
      </div>
    </nav>
  );
}

export default Navbar;
