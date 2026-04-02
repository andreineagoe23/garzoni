import React, { useEffect, useRef } from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { ThemeProvider } from "contexts/ThemeContext";
import { AuthProvider } from "contexts/AuthContext";
import { AdminProvider } from "contexts/AdminContext";
import { RecaptchaEnterpriseProvider } from "contexts/RecaptchaContext";
import { CookieConsentProvider } from "contexts/CookieConsentContext";
import CookieConsentBanner from "components/legal/CookieConsentBanner";
import ErrorBoundary from "components/common/ErrorBoundary";
import { queryClient } from "lib/reactQuery";
import { useOnlineSync } from "hooks/useOnlineSync";
import AppShell from "./routes/AppShell";

const publicPaths = [
  "/",
  "/login",
  "/register",
  "/welcome",
  "/forgot-password",
  "/password-reset",
  "/payment-required",
  "/privacy-policy",
  "/cookie-policy",
  "/terms-of-service",
  "/financial-disclaimer",
  "/subscriptions",
];

const noNavbarPaths = [...publicPaths, "/onboarding", "/payment-success"];
const noChatbotPaths = [...publicPaths, "/onboarding", "/payment-success"];
const noFooterPaths = [
  "/",
  "/welcome",
  "/subscriptions",
  "/login",
  "/register",
  "/forgot-password",
  "/password-reset",
  "/onboarding",
];

const AppContent = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const prevPathnameRef = useRef<string | null>(null);
  const isCourseFlowPath =
    /^\/(lessons\/\d+\/flow|courses\/\d+\/lessons\/\d+\/flow)$/.test(
      location.pathname
    );

  useOnlineSync();

  useEffect(() => {
    const pathname = location.pathname;
    const prevPathname = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const isDashboardTab = (path: string) =>
      path === "/all-topics" || path === "/personalized-path";

    // Preserve scroll position only when switching between dashboard tabs.
    if (
      prevPathname &&
      isDashboardTab(prevPathname) &&
      isDashboardTab(pathname) &&
      prevPathname !== pathname
    ) {
      return;
    }

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [location.pathname, location.search]);

  return (
    <ThemeProvider>
      <AppShell
        noNavbarPaths={noNavbarPaths}
        noFooterPaths={noFooterPaths}
        noChatbotPaths={noChatbotPaths}
        isCourseFlowPath={isCourseFlowPath}
        fallbackNavbar={t("shared.loadingNav")}
        fallbackPage={t("shared.loadingPage")}
      />
      <CookieConsentBanner />
      <Toaster position="top-right" />
    </ThemeProvider>
  );
};

const AppRoot = () => {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";
  const appTree = (
    <AuthProvider>
      <AdminProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AdminProvider>
    </AuthProvider>
  );

  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        {siteKey ? (
          <RecaptchaEnterpriseProvider siteKey={siteKey}>
            <CookieConsentProvider>{appTree}</CookieConsentProvider>
          </RecaptchaEnterpriseProvider>
        ) : (
          <CookieConsentProvider>{appTree}</CookieConsentProvider>
        )}
      </QueryClientProvider>
    </Router>
  );
};

export default AppRoot;
