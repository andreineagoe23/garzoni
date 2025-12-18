import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MoonStarsFill, SunFill, BoxArrowRight } from "react-bootstrap-icons";
import { useTheme } from "contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { useAdmin } from "contexts/AdminContext";
import { GlassContainer } from "components/ui";

const NAV_ITEMS = [
  { path: "/all-topics", label: "Dashboard", icon: "🏠" },
  { path: "/leaderboards", label: "Leaderboards", icon: "🏆" },
  { path: "/exercises", label: "Exercises", icon: "💪" },
  { path: "/missions", label: "Missions", icon: "🎯" },
  { path: "/tools", label: "Tools", icon: "🛠️" },
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
  const { adminMode, toggleAdminMode, canAdminister } = useAdmin();
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
      if (window.innerWidth >= 1024) {
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
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm",
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
          className="relative z-[1201] flex min-h-[56px] items-center justify-center gap-6 px-3 py-2 sm:min-h-[72px] sm:gap-10 sm:px-4 sm:py-3"
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex min-w-[160px] flex-1 items-center justify-start gap-3 lg:min-w-[240px]">
            <div className="flex items-center gap-2">
              <NavLink
                to="/all-topics"
                onClick={closeMenu}
                className="relative z-10 text-base font-semibold uppercase tracking-[0.18em] text-[color:var(--text-color,#111827)] no-underline transition hover:text-[color:var(--primary,#1d5330)] hover:no-underline touch-manipulation sm:text-lg"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Monevo
              </NavLink>
            </div>
          </div>

          <div className="hidden flex-[2] items-center justify-center lg:flex">
            <div className="flex items-center justify-center gap-2 px-2 py-1">
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
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="flex min-w-[180px] flex-1 items-center justify-end gap-4 lg:min-w-[240px]">
            {canAdminister && (
              <button
                type="button"
                onClick={() => toggleAdminMode()}
                aria-pressed={adminMode}
                className={`relative z-10 inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 ${
                  adminMode
                    ? "border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)] text-white shadow"
                    : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)]"
                } focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation`}
              >
                {adminMode ? "Admin Mode" : "Enable Admin"}
              </button>
            )}

            <button
              type="button"
              onClick={handleDarkModeToggle}
              aria-label="Toggle dark mode"
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-10 sm:w-10"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {darkMode ? <SunFill size={18} /> : <MoonStarsFill size={18} />}
            </button>

            <button
              type="button"
              onClick={handleLogoutClick}
              aria-label="Logout"
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-10 sm:w-10"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <BoxArrowRight size={18} />
            </button>

            <button
              type="button"
              onClick={handleProfileClick}
              aria-label="Go to profile"
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/80 shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/40 hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:h-10 sm:w-10"
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
              className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 lg:hidden touch-manipulation sm:h-10 sm:w-10"
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
          className={`${menuVisibility} relative z-[1201] mt-3 flex-col gap-2 px-4 pb-4 pt-2 lg:hidden`}
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
