import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Login from "components/auth/Login";
import Register from "components/auth/Register";
import Welcome from "components/landing/Welcome";
import CoursePage from "components/courses/CoursePage";
import LessonPage from "components/courses/LessonPage";
import Dashboard from "components/dashboard/Dashboard";
import Navbar from "components/layout/Navbar";
import Profile from "components/profile/Profile";
import Settings from "components/profile/Settings";
import QuizPage from "components/courses/QuizPage";
import Leaderboards from "components/engagement/Leaderboard";
import Missions from "components/engagement/Missions";
import Questionnaire from "components/onboarding/Questionnaire";
import ToolsPage from "components/tools/ToolsPage";
import ForgotPassword from "components/auth/ForgotPassword";
import ResetPassword from "components/auth/ResetPassword";
import RewardsPage from "components/rewards/RewardsPage";
import FAQPage from "components/support/FAQPage";
import { ThemeProvider } from "contexts/ThemeContext";
import { AuthProvider } from "contexts/AuthContext";
import { AdminProvider } from "contexts/AdminContext";
import ProtectedRoute from "components/auth/ProtectedRoute";
import ExercisePage from "components/exercises/ExercisePage";
import PaymentRequired from "components/billing/PaymentRequired";
import "styles/scss/main.scss";
import Chatbot from "components/widgets/Chatbot";
import PrivacyPolicy from "components/legal/PrivacyPolicy";
import CookiePolicy from "components/legal/CookiePolicy";

function App() {
  return (
    <Router>
      <AppContent />
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

  return (
    <AuthProvider>
      <AdminProvider>
        <ThemeProvider>
          <div
            className={[
              "app-container",
              noChatbotPaths.includes(location.pathname) ? "nochatbot" : "",
            ]
              .join(" ")
              .trim()}
          >
            {hasNavbar && <Navbar />}

            <div className="app-layout w-full p-0">
              <main
                className="content"
                style={hasNavbar ? { paddingTop: "88px" } : undefined}
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
              </main>

              {!noChatbotPaths.includes(location.pathname) && <Chatbot />}
            </div>
          </div>
        </ThemeProvider>
      </AdminProvider>
    </AuthProvider>
  );
};

export default App;
