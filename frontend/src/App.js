import React from "react";
import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
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

function AppContent() {
  const location = useLocation();

  const noNavbarPaths = ["/", "/login", "/register"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Conditionally render Navbar based on the current route */}
      {!noNavbarPaths.includes(location.pathname) && <Navbar />}

      <div
        className={
          noNavbarPaths.includes(location.pathname) ? "page-without-navbar" : ""
        }
        style={{ padding: "20px", width: "100%", flexGrow: 1 }}
      >
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/courses/:pathId" element={<CoursePage />} />
          <Route path="/lessons/:courseId" element={<LessonPage />} />
          <Route path="/quiz/:courseId" element={<QuizPage />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/questionnaire" element={<Questionnaire />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/welcome" element={<Welcome />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
