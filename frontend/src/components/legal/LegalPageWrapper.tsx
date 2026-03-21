import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "contexts/AuthContext";
import Header from "components/layout/Header";
import { GlassContainer } from "components/ui";

const LEGAL_PATHS = [
  { path: "/privacy-policy", labelKey: "footer.privacyPolicy" },
  { path: "/cookie-policy", labelKey: "footer.cookiePolicy" },
  { path: "/terms-of-service", labelKey: "footer.termsConditions" },
  { path: "/financial-disclaimer", labelKey: "footer.financialDisclaimer" },
];

/**
 * Wraps legal page content when user is not authenticated: shows Header and a minimal
 * footer with links to other legal pages and back to Welcome, so the user doesn't see
 * the full app footer and can navigate easily.
 */
export default function LegalPageWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1 pt-[72px] sm:pt-[88px]">{children}</div>
      <footer
        className="mt-auto border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] px-4 py-6"
        aria-label={t("footer.ariaLabel")}
      >
        <GlassContainer
          variant="subtle"
          className="mx-auto max-w-4xl px-4 py-4 sm:px-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/"
              className="text-sm font-semibold text-[color:var(--primary,#1d5330)] hover:underline"
            >
              ← {t("footer.backToWelcome")}
            </Link>
            <nav
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[color:var(--muted-text,#6b7280)]"
              aria-label="Legal and policy links"
            >
              {LEGAL_PATHS.map(({ path, labelKey }) => (
                <span key={path}>
                  {location.pathname === path ? (
                    <span className="font-medium text-[color:var(--text-color,#111827)]">
                      {t(labelKey)}
                    </span>
                  ) : (
                    <Link
                      to={path}
                      className="text-[color:var(--primary,#1d5330)] hover:underline"
                    >
                      {t(labelKey)}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          </div>
        </GlassContainer>
      </footer>
    </div>
  );
}
