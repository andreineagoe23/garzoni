import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import UserProgressBox from "./UserProgressBox";
import Chatbot from "./Chatbot";
import "../styles/Dashboard.css";
import "../styles/PersonalizedPath.css";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const activePage = location.pathname.includes("personalized-path")
    ? "personalized-path"
    : "all-topics";

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          { withCredentials: true }
        );

        setUser(profileResponse.data.user_data);
        setIsQuestionnaireCompleted(
          profileResponse.data.is_questionnaire_completed
        );
      } catch (error) {
        console.error("Error fetching user data:", error);
        navigate("/login");
      }
    };

    const fetchUserProgress = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprogress/`,
          { withCredentials: true }
        );
        setUserProgress(response.data);
      } catch (error) {
        console.error("Error fetching user progress:", error);
      }
    };

    fetchUserData();
    fetchUserProgress();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/logout/`,
        {},
        { withCredentials: true }
      );
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const toggleProgressPanel = () => {
    setShowProgress((prev) => !prev);
  };

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="dashboard-header">
          <h2 className="dashboard-greeting">
            Welcome back, {user?.username || "User"}!
          </h2>
          <button className="button button--logout" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="dashboard-buttons">
          <button
            className={`button button--nav ${
              activePage === "all-topics" ? "button--active" : ""
            }`}
            onClick={() => navigate("/all-topics")}
          >
            All Topics
          </button>

          <button
            className={`button button--nav ${
              isQuestionnaireCompleted ? "" : "button--disabled"
            } ${activePage === "personalized-path" ? "button--active" : ""}`}
            onClick={() => {
              if (isQuestionnaireCompleted) {
                navigate("/personalized-path");
              } else {
                navigate("/questionnaire");
              }
            }}
          >
            Personalized Path
          </button>
        </div>

        {activePage === "all-topics" ? (
          <AllTopics onCourseClick={handleCourseClick} />
        ) : (
          <PersonalizedPath onCourseClick={handleCourseClick} />
        )}
      </div>

      <div className="user-progress">
        {userProgress ? (
          <UserProgressBox userProgress={userProgress} />
        ) : (
          <p>Loading progress...</p>
        )}
      </div>

      <button className="floating-progress-btn" onClick={toggleProgressPanel}>
        Progress
      </button>

      {showProgress && (
        <div className="progress-panel">
          <button className="close-panel-btn" onClick={toggleProgressPanel}>
            Close
          </button>
          <UserProgressBox userProgress={userProgress} />
        </div>
      )}

      <Chatbot />
    </div>
  );
}

export default Dashboard;
