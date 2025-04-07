import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Container } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
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
import { ThemeProvider } from "../src/components/ThemeContext";
import ExercisePage from "./components/ExercisePage";
import PaymentRequired from "./components/PaymentRequired";
import "./styles/scss/main.scss";
import Chatbot from "./components/Chatbot";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

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
      <ThemeProvider>
        <div className="app-container">
          <AppContent
            toggleChatbot={() => setIsChatbotVisible(!isChatbotVisible)}
            isChatbotVisible={isChatbotVisible}
            setIsChatbotVisible={setIsChatbotVisible}
            isMobileView={isMobileView}
          />
        </div>
        
      </ThemeProvider>
    </Router>
  );
}
const AppContent = ({
  toggleChatbot,
  isChatbotVisible,
  setIsChatbotVisible,
  isMobileView,
}) => {
  const location = useLocation();

  const noNavbarPaths = [
    "/",
    "/login",
    "/register",
    "/welcome",
    "/forgot-password",
    "/password-reset",
    "/questionnaire",
    "/payment-required",
  ];
  const noChatbotPaths = ["/login", "/register", "/questionnaire", "/welcome" ,"/forgot-password", "/password-reset", "/", "/payment-required" ];

  axios.interceptors.request.use((config) => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (tokens?.access) {
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  });

  return (
    <Container fluid className="app-layout p-0">
      {!noNavbarPaths.includes(location.pathname) && (
        <Navbar toggleChatbot={toggleChatbot} />
      )}

      <main className="content">
        <ThemeProvider>
        <Analytics />
        <SpeedInsights />
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/all-topics"
              element={<Dashboard key="all-topics" activePage="all-topics" />}
            />
            <Route
              path="/personalized-path"
              element={
                <Dashboard
                  key="personalized-path"
                  activePage="personalized-path"
                />
              }
            />
            <Route path="/payment-required" element={<PaymentRequired />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/courses/:pathId" element={<CoursePage />} />
            <Route path="/lessons/:courseId" element={<LessonPage />} />
            <Route path="/quiz/:courseId" element={<QuizPage />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/password-reset/:uidb64/:token"
              element={<ResetPassword />}
            />
            <Route path="/exercises" element={<ExercisePage />} />
          </Routes>
        </ThemeProvider>
      </main>

      {!noChatbotPaths.includes(location.pathname) && (
        <Chatbot
          isVisible={isChatbotVisible}
          setIsVisible={setIsChatbotVisible}
          isMobile={isMobileView}
        />
      )}
    </Container>
  );
};

export default App;
