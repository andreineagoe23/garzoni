/**
 * App root: router, providers, and route definitions.
 * Page components are lazy-loaded except SubscriptionPlans (static import so it stays in main bundle).
 */
import React, { Suspense, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "contexts/ThemeContext";
import { AuthProvider } from "contexts/AuthContext";
import { AdminProvider } from "contexts/AdminContext";
import { RecaptchaEnterpriseProvider } from "contexts/RecaptchaContext";
import { CookieConsentProvider } from "contexts/CookieConsentContext";
import CookieConsentBanner from "components/legal/CookieConsentBanner";
import { queryClient } from "lib/reactQuery";
import ProtectedRoute from "components/auth/ProtectedRoute";
import Chatbot from "components/widgets/Chatbot";
import ErrorBoundary from "components/common/ErrorBoundary";
import { useOnlineSync } from "hooks/useOnlineSync";
import { useAuth } from "contexts/AuthContext";
import LegalPageWrapper from "components/legal/LegalPageWrapper";
import Login from "components/auth/Login";
import Register from "components/auth/Register";
import AuthCallback from "components/auth/AuthCallback";
import ForgotPassword from "components/auth/ForgotPassword";
import ResetPassword from "components/auth/ResetPassword";
import SubscriptionPlans from "./SubscriptionPlansPage";
const Welcome = React.lazy(() => import("./components/landing/Welcome"));
const CoursePage = React.lazy(() => import("./components/courses/CoursePage"));
const CourseFlowPage = React.lazy(
  () => import("./components/courses/CourseFlowPage")
);
const Dashboard = React.lazy(() => import("./components/dashboard/Dashboard"));
const Navbar = React.lazy(() => import("./components/layout/Navbar"));
const Footer = React.lazy(() => import("./components/layout/Footer"));
const Profile = React.lazy(() => import("./components/profile/Profile"));
const Settings = React.lazy(() => import("./components/profile/Settings"));
const QuizPage = React.lazy(() => import("./components/courses/QuizPage"));
const Leaderboards = React.lazy(
  () => import("./components/engagement/Leaderboard")
);
const Missions = React.lazy(() => import("./components/engagement/Missions"));
const OnboardingQuestionnaire = React.lazy(
  () => import("./components/onboarding/OnboardingQuestionnaire")
);
const ToolsPage = React.lazy(() => import("./components/tools/ToolsPage"));
const RewardsPage = React.lazy(
  () => import("./components/rewards/RewardsPage")
);
const SupportPage = React.lazy(
  () => import("./components/support/SupportPage")
);
const ExercisePage = React.lazy(
  () => import("./components/exercises/ExercisePage")
);
const UpgradePage = React.lazy(() => import("./components/billing/Upgrade"));
const SubscriptionManager = React.lazy(
  () => import("./components/billing/SubscriptionManager")
);
const PaymentSuccessPage = React.lazy(
  () => import("./components/billing/PaymentSuccessPage")
);
const PrivacyPolicy = React.lazy(
  () => import("./components/legal/PrivacyPolicy")
);
const CookiePolicy = React.lazy(
  () => import("./components/legal/CookiePolicy")
);
const TermsOfService = React.lazy(
  () => import("./components/legal/TermsOfService")
);
const FinancialDisclaimer = React.lazy(
  () => import("./components/legal/FinancialDisclaimer")
);
const PricingFunnelDashboard = React.lazy(
  () => import("./components/analytics/PricingFunnelDashboard")
);

const preloaders = [
  () => import("./components/dashboard/Dashboard"),
  () => import("./components/courses/CoursePage"),
  () => import("./components/courses/CourseFlowPage"),
  () => import("./components/billing/SubscriptionManager"),
  () => import("./components/engagement/Missions"),
  () => import("./components/profile/Profile"),
];

const canPrefetchChunks = () => {
  if (typeof navigator === "undefined") return false;
  const connection =
    (navigator as Navigator).connection ||
    (navigator as Navigator).mozConnection ||
    (navigator as Navigator).webkitConnection;
  if (!connection) return true;
  if (connection.saveData) return false;
  const effectiveType = (connection as NetworkInformation).effectiveType;
  return !["slow-2g", "2g"].includes(effectiveType || "");
};

const prefetchOnIdle = (preload: () => Promise<unknown>) => {
  if (typeof window === "undefined") return;
  const run = () => preload().catch(() => undefined);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1500);
  }
};

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";

const LEGAL_PATHS = [
  "/privacy-policy",
  "/cookie-policy",
  "/terms-of-service",
  "/financial-disclaimer",
];

type AuthAwareLayoutProps = {
  noNavbarPaths: string[];
  noFooterPaths: string[];
  noChatbotPaths: string[];
  isCourseFlowPath: boolean;
  fallbackNavbar: string;
  fallbackPage: string;
};

function AuthAwareLayout({
  noNavbarPaths,
  noFooterPaths,
  noChatbotPaths,
  isCourseFlowPath,
  fallbackNavbar,
  fallbackPage,
}: AuthAwareLayoutProps) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const isLegalPath = LEGAL_PATHS.includes(location.pathname);
  const isLegalAndUnauth = isLegalPath && !isAuthenticated;
  const hasNavbar =
    !isCourseFlowPath &&
    !isLegalAndUnauth &&
    ((isLegalPath && isAuthenticated) ||
      !noNavbarPaths.includes(location.pathname));
  const hasFooter =
    !noFooterPaths.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    ) &&
    !isCourseFlowPath &&
    !isLegalAndUnauth;

  return (
    <div
      className={[
        "app-container",
        "min-h-screen flex flex-col",
        noChatbotPaths.includes(location.pathname) ? "nochatbot" : "",
      ]
        .join(" ")
        .trim()}
    >
      {hasNavbar && (
        <Suspense fallback={<div className="p-4">{fallbackNavbar}</div>}>
          <Navbar />
        </Suspense>
      )}
      <div className="app-layout w-full flex-1 flex flex-col p-0">
        <main
          className="content flex-1"
          style={hasNavbar ? { paddingTop: "88px" } : undefined}
        >
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--muted-text,#6b7280)]">
                {fallbackPage}
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route
                path="/privacy-policy"
                element={
                  <LegalPageWrapper>
                    <PrivacyPolicy />
                  </LegalPageWrapper>
                }
              />
              <Route
                path="/cookie-policy"
                element={
                  <LegalPageWrapper>
                    <CookiePolicy />
                  </LegalPageWrapper>
                }
              />
              <Route
                path="/terms-of-service"
                element={
                  <LegalPageWrapper>
                    <TermsOfService />
                  </LegalPageWrapper>
                }
              />
              <Route
                path="/financial-disclaimer"
                element={
                  <LegalPageWrapper>
                    <FinancialDisclaimer />
                  </LegalPageWrapper>
                }
              />
              <Route
                path="/no-financial-advice"
                element={<Navigate to="/financial-disclaimer#no-advice" replace />}
              />
              <Route
                path="/pricing"
                element={<Navigate to="/subscriptions" replace />}
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <OnboardingQuestionnaire />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route
                path="/subscriptions"
                element={
                  <ErrorBoundary>
                    <SubscriptionPlans />
                  </ErrorBoundary>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/all-topics"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Dashboard key="all-topics" activePage="all-topics" />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/personalized-path"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Dashboard
                        key="personalized-path"
                        activePage="personalized-path"
                      />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="/payment-required" element={<UpgradePage />} />
              <Route
                path="/payment-success"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <PaymentSuccessPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Profile />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Settings />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <SubscriptionManager />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rewards"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <RewardsPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:pathId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <CoursePage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lessons/:courseId/flow"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <CourseFlowPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:pathId/lessons/:courseId/flow"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <CourseFlowPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quiz/:courseId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <QuizPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leaderboards"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Leaderboards />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/missions"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Missions />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pricing-dashboard"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <PricingFunnelDashboard />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tools/*"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ToolsPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route
                path="/password-reset/:uidb64/:token"
                element={<ResetPassword />}
              />
              <Route
                path="/exercises"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ExercisePage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exercise/:exerciseId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <ExercisePage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/support"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <SupportPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </main>
        {!noChatbotPaths.includes(location.pathname) && !isCourseFlowPath && (
          <Chatbot />
        )}
        {hasFooter && (
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        {RECAPTCHA_SITE_KEY ? (
          <RecaptchaEnterpriseProvider siteKey={RECAPTCHA_SITE_KEY}>
            <CookieConsentProvider>
              <AppContent />
              <CookieConsentBanner />
            </CookieConsentProvider>
          </RecaptchaEnterpriseProvider>
        ) : (
          <CookieConsentProvider>
            <AppContent />
            <CookieConsentBanner />
          </CookieConsentProvider>
        )}
      </QueryClientProvider>
    </Router>
  );
}

const AppContent = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isCourseFlowPath =
    location.pathname.includes("/lessons/") &&
    location.pathname.endsWith("/flow");
  const didPrefetchRef = useRef(false);

  useOnlineSync();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (didPrefetchRef.current) return;
    didPrefetchRef.current = true;
    if (!canPrefetchChunks()) return;
    preloaders.forEach((preload) => prefetchOnIdle(preload));
  }, []);

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
  useEffect(() => {
    if (
      typeof window.gtag === "function" &&
      window.__MONEVO_CONSENT__?.analytics
    ) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        send_to: "G-99E61ZXSV9",
      });
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const shouldRecoverFromChunkError = (
      errOrMsg: unknown,
      urlHint?: string
    ) => {
      const errorish = errOrMsg as {
        message?: string;
        reason?: { message?: string; name?: string };
        name?: string;
      };
      const message = String(
        errorish?.message || errorish?.reason?.message || errorish || ""
      );
      const name = String(errorish?.name || errorish?.reason?.name || "");
      const url = String(urlHint || "");

      return (
        name === "ChunkLoadError" ||
        /ChunkLoadError/i.test(message) ||
        /Loading (CSS )?chunk \d+ failed/i.test(message) ||
        /Loading chunk \d+ failed/i.test(message) ||
        /\.chunk\.(css|js)/i.test(url) ||
        /\.chunk\.(css|js)/i.test(message)
      );
    };

    const recover = () => {
      try {
        const key = "monevo_chunkload_recovered_v1";
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");

        if (typeof window !== "undefined" && "caches" in window) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .catch(() => undefined);
        }

        const href = window.location.href;
        const [basePart, hashPart] = href.split("#");
        const baseUrl = basePart.split("?")[0];
        const nextUrl = `${baseUrl}?v=${Date.now()}${
          hashPart ? `#${hashPart}` : ""
        }`;
        window.location.replace(nextUrl);
      } catch (_) {
        try {
          window.location.reload();
        } catch (__) {
          // ignore
        }
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (shouldRecoverFromChunkError(event?.reason)) {
        recover();
      }
    };

    const onWindowError = (event: Event) => {
      // Resource load failures come through as ErrorEvent with a target element.
      const errorEvent = event as ErrorEvent;
      const target = event.target;
      const href =
        target instanceof HTMLLinkElement
          ? target.href
          : target instanceof HTMLScriptElement
            ? target.src
            : undefined;
      if (
        shouldRecoverFromChunkError(
          errorEvent?.error || errorEvent?.message,
          href
        )
      ) {
        recover();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    // Capture phase helps catch <link>/<script> resource errors.
    window.addEventListener("error", onWindowError, true);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError, true);
    };
  }, []);

  const content = (
    <ThemeProvider>
      <AuthAwareLayout
        noNavbarPaths={noNavbarPaths}
        noFooterPaths={noFooterPaths}
        noChatbotPaths={noChatbotPaths}
        isCourseFlowPath={isCourseFlowPath}
        fallbackNavbar={t("shared.loadingNav")}
        fallbackPage={t("shared.loadingPage")}
      />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--card-bg,#ffffff)",
            color: "var(--text-color,#111827)",
            borderRadius: "9999px",
            border: "1px solid var(--border-color,rgba(0,0,0,0.08))",
            boxShadow:
              "0 18px 45px rgba(15,23,42,0.28), 0 0 0 1px rgba(15,23,42,0.05)",
          },
          success: {
            style: {
              background: "rgba(var(--primary-rgb,37,99,235),0.14)",
              color: "var(--text-color,#111827)",
              borderColor: "rgba(var(--primary-rgb,37,99,235),0.45)",
            },
          },
          error: {
            style: {
              background: "rgba(220,38,38,0.12)",
              color: "var(--text-color,#111827)",
              borderColor: "rgba(220,38,38,0.55)",
            },
          },
        }}
      />
    </ThemeProvider>
  );

  return (
    <AuthProvider>
      <AdminProvider>
        <ErrorBoundary>{content}</ErrorBoundary>
      </AdminProvider>
    </AuthProvider>
  );
};

export default App;
