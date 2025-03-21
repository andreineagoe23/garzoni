import React, { useState, useCallback } from "react";
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
import { ThemeProvider } from "../src/components/ThemeContext";
import ExercisePage from "./components/ExercisePage";
import "./styles/scss/main.scss";
import Chatbot from "./components/Chatbot";

function App() {
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);

  const toggleChatbot = useCallback(() => {
    setIsChatbotVisible((prev) => !prev);
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <div className="app-container">
          <AppContent toggleChatbot={toggleChatbot} />
          <Chatbot
            isVisible={isChatbotVisible}
            setIsVisible={setIsChatbotVisible}
          />
        </div>
      </ThemeProvider>
    </Router>
  );
}

const AppContent = ({ toggleChatbot }) => {
  const location = useLocation();
  console.log("[AppContent] Current path:", location.pathname);

  const noNavbarPaths = [
    "/",
    "/login",
    "/register",
    "/welcome",
    "/forgot-password",
    "/password-reset",
    "/questionnaire",
  ];

  return (
    <Container fluid className="app-layout p-0">
      {!noNavbarPaths.includes(location.pathname) && (
        <Navbar toggleChatbot={toggleChatbot} />
      )}
      <main className="content">
        <ThemeProvider>
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
    </Container>
  );
};

export default App;
