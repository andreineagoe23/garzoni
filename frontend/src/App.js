import React, { Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "contexts/ThemeContext";
import { AuthProvider } from "contexts/AuthContext";
import { AdminProvider } from "contexts/AdminContext";
import { queryClient } from "lib/reactQuery";
import ProtectedRoute from "components/auth/ProtectedRoute";
import Chatbot from "components/widgets/Chatbot";
import ErrorBoundary from "components/common/ErrorBoundary";
import "styles/scss/main.scss";

const Login = React.lazy(() => import("components/auth/Login"));
const Register = React.lazy(() => import("components/auth/Register"));
const Welcome = React.lazy(() => import("components/landing/Welcome"));
const CoursePage = React.lazy(() => import("components/courses/CoursePage"));
const CourseFlowPage = React.lazy(() =>
  import("components/courses/CourseFlowPage")
);
const Dashboard = React.lazy(() => import("components/dashboard/Dashboard"));
const Navbar = React.lazy(() => import("components/layout/Navbar"));
const Footer = React.lazy(() => import("components/layout/Footer"));
const Profile = React.lazy(() => import("components/profile/Profile"));
const Settings = React.lazy(() => import("components/profile/Settings"));
const QuizPage = React.lazy(() => import("components/courses/QuizPage"));
const Leaderboards = React.lazy(() =>
  import("components/engagement/Leaderboard")
);
const Missions = React.lazy(() => import("components/engagement/Missions"));
const Questionnaire = React.lazy(() =>
  import("components/onboarding/Questionnaire")
);
const ToolsPage = React.lazy(() => import("components/tools/ToolsPage"));
const ForgotPassword = React.lazy(() =>
  import("components/auth/ForgotPassword")
);
const ResetPassword = React.lazy(() => import("components/auth/ResetPassword"));
const RewardsPage = React.lazy(() => import("components/rewards/RewardsPage"));
const FAQPage = React.lazy(() => import("components/support/FAQPage"));
const ExercisePage = React.lazy(() =>
  import("components/exercises/ExercisePage")
);
const UpgradePage = React.lazy(() => import("components/billing/Upgrade"));
const PrivacyPolicy = React.lazy(() =>
  import("components/legal/PrivacyPolicy")
);
const CookiePolicy = React.lazy(() => import("components/legal/CookiePolicy"));
const PricingPage = React.lazy(() => import("components/landing/Pricing"));
const PricingFunnelDashboard = React.lazy(() =>
  import("components/analytics/PricingFunnelDashboard")
);

const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? React.lazy(() =>
        import("@tanstack/react-query-devtools").then((m) => ({
          default: m.ReactQueryDevtools,
        }))
      )
    : null;

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AppContent />
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </Router>
  );
}

const AppContent = () => {
  const location = useLocation();
  const isCourseFlowPath =
    location.pathname.includes("/lessons/") &&
    location.pathname.endsWith("/flow");

  const publicPaths = [
    "/",
    "/login",
    "/register",
    "/welcome",
    "/forgot-password",
    "/password-reset",
    "/questionnaire",
    "/payment-required",
    "/privacy-policy",
    "/cookie-policy",
    "/pricing",
  ];

  const noNavbarPaths = publicPaths;
  const noChatbotPaths = publicPaths;
  // Pages that render a standalone marketing/auth layout (they render their own Footer)
  const noFooterPaths = [
    "/",
    "/welcome",
    "/pricing",
    "/login",
    "/register",
    "/forgot-password",
    "/password-reset",
  ];

  useEffect(() => {
    if (
      typeof window.gtag === "function" &&
      window.Cookiebot?.consent?.statistics
    ) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        send_to: "G-0H3QCDXCE8",
      });
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const shouldRecoverFromChunkError = (errOrMsg, urlHint) => {
      const message = String(
        errOrMsg?.message || errOrMsg?.reason?.message || errOrMsg || ""
      );
      const name = String(errOrMsg?.name || errOrMsg?.reason?.name || "");
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
            .catch(() => {});
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

    const onUnhandledRejection = (event) => {
      if (shouldRecoverFromChunkError(event?.reason)) {
        recover();
      }
    };

    const onWindowError = (event) => {
      // Resource load failures come through as ErrorEvent with a target element.
      const target = event?.target;
      const href = target?.href || target?.src;
      if (shouldRecoverFromChunkError(event?.error || event?.message, href)) {
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

  const hasNavbar =
    !noNavbarPaths.includes(location.pathname) && !isCourseFlowPath;
  const hasFooter =
    !noFooterPaths.some(
      (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
    ) && !isCourseFlowPath;

  const content = (
    <ThemeProvider>
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
          <Suspense fallback={<div className="p-4">Loading navigation...</div>}>
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
                  Loading page...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/cookie-policy" element={<CookiePolicy />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/questionnaire" element={<Questionnaire />} />
                <Route path="/upgrade" element={<UpgradePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/all-topics"
                  element={
                    <ProtectedRoute>
                      <Dashboard key="all-topics" activePage="all-topics" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/personalized-path"
                  element={
                    <ProtectedRoute>
                      <Dashboard
                        key="personalized-path"
                        activePage="personalized-path"
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/payment-required" element={<UpgradePage />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rewards"
                  element={
                    <ProtectedRoute>
                      <RewardsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:pathId"
                  element={
                    <ProtectedRoute>
                      <CoursePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lessons/:courseId/flow"
                  element={
                    <ProtectedRoute>
                      <CourseFlowPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:pathId/lessons/:courseId/flow"
                  element={
                    <ProtectedRoute>
                      <CourseFlowPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quiz/:courseId"
                  element={
                    <ProtectedRoute>
                      <QuizPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leaderboards"
                  element={
                    <ProtectedRoute>
                      <Leaderboards />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/missions"
                  element={
                    <ProtectedRoute>
                      <Missions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pricing-dashboard"
                  element={
                    <ProtectedRoute>
                      <PricingFunnelDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools"
                  element={
                    <ProtectedRoute>
                      <ToolsPage />
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
                      <ExercisePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/exercise/:exerciseId"
                  element={
                    <ProtectedRoute>
                      <ExercisePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/faq"
                  element={
                    <ProtectedRoute>
                      <FAQPage />
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
      <Toaster position="top-right" />
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
