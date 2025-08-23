import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Container } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./components/Login";
import Register from "./components/Register";
import Welcome from "./components/Welcome";
import CoursePage from "./components/CoursePage";
import LessonPage from "./components/LessonPage";
import Dashboard from "./components/Dashboard";
import Navbar from "./components/Navbar";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import QuizPage from "./components/QuizPage";
import Leaderboards from "./components/Leaderboard";
import Missions from "./components/Missions";
import Questionnaire from "./components/Questionnaire";
import ToolsPage from "./components/ToolsPage";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import RewardsPage from "./components/RewardsPage";
import FAQPage from "./components/FAQPage";
import { ThemeProvider } from "../src/components/ThemeContext";
import { AuthProvider } from "./components/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ExercisePage from "./components/ExercisePage";
import PaymentRequired from "./components/PaymentRequired";
import "./styles/scss/main.scss";
import Chatbot from "./components/Chatbot";
import PrivacyPolicy from "./components/PrivacyPolicy";
import CookiePolicy from "./components/CookiePolicy";

function App() {
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth <= 992);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <Router>
      <AppContent
        toggleChatbot={() => setIsChatbotVisible(!isChatbotVisible)}
        isChatbotVisible={isChatbotVisible}
        setIsChatbotVisible={setIsChatbotVisible}
        isMobileView={isMobileView}
      />
    </Router>
  );
}

const AppContent = ({ toggleChatbot, isChatbotVisible, isMobileView }) => {
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

  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="app-container">
          <Container fluid className="app-layout p-0">
            {!noNavbarPaths.includes(location.pathname) && (
              <Navbar toggleChatbot={toggleChatbot} />
            )}

            <main className="content">
              <ThemeProvider>
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
                  <Route
                    path="/payment-required"
                    element={<PaymentRequired />}
                  />
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
              </ThemeProvider>
            </main>

            {!noChatbotPaths.includes(location.pathname) && (
              <Chatbot
                isVisible={isChatbotVisible}
                onClose={toggleChatbot}
                isMobile={isMobileView}
              />
            )}
          </Container>
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
