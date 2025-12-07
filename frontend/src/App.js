import React, { Suspense, useEffect } from "react";
import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "contexts/ThemeContext";
import { AuthProvider } from "contexts/AuthContext";
import { AdminProvider } from "contexts/AdminContext";
import ProtectedRoute from "components/auth/ProtectedRoute";
import Chatbot from "components/widgets/Chatbot";
import ErrorBoundary from "components/common/ErrorBoundary";
import "styles/scss/main.scss";

const Login = React.lazy(() => import("components/auth/Login"));
const Register = React.lazy(() => import("components/auth/Register"));
const Welcome = React.lazy(() => import("components/landing/Welcome"));
const CoursePage = React.lazy(() => import("components/courses/CoursePage"));
const LessonPage = React.lazy(() => import("components/courses/LessonPage"));
const Dashboard = React.lazy(() => import("components/dashboard/Dashboard"));
const Navbar = React.lazy(() => import("components/layout/Navbar"));
const Profile = React.lazy(() => import("components/profile/Profile"));
const Settings = React.lazy(() => import("components/profile/Settings"));
const QuizPage = React.lazy(() => import("components/courses/QuizPage"));
const Leaderboards = React.lazy(() => import("components/engagement/Leaderboard"));
const Missions = React.lazy(() => import("components/engagement/Missions"));
const Questionnaire = React.lazy(() => import("components/onboarding/Questionnaire"));
const ToolsPage = React.lazy(() => import("components/tools/ToolsPage"));
const ForgotPassword = React.lazy(() => import("components/auth/ForgotPassword"));
const ResetPassword = React.lazy(() => import("components/auth/ResetPassword"));
const RewardsPage = React.lazy(() => import("components/rewards/RewardsPage"));
const FAQPage = React.lazy(() => import("components/support/FAQPage"));
const ExercisePage = React.lazy(() => import("components/exercises/ExercisePage"));
const PaymentRequired = React.lazy(() => import("components/billing/PaymentRequired"));
const PrivacyPolicy = React.lazy(() => import("components/legal/PrivacyPolicy"));
const CookiePolicy = React.lazy(() => import("components/legal/CookiePolicy"));

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </Router>
  );
}

const AppContent = () => {
  const location = useLocation();

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
  ];

  const noNavbarPaths = publicPaths;
  const noChatbotPaths = publicPaths;

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

  const hasNavbar = !noNavbarPaths.includes(location.pathname);

  const content = (
    <ThemeProvider>
      <div
        className={[
          "app-container",
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

        <div className="app-layout w-full p-0">
          <main
            className="content"
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
                <Route path="/questionnaire" element={<Questionnaire />} />
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
                <Route path="/payment-required" element={<PaymentRequired />} />
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
                  path="/lessons/:courseId"
                  element={
                    <ProtectedRoute>
                      <LessonPage />
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

          {!noChatbotPaths.includes(location.pathname) && <Chatbot />}
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
