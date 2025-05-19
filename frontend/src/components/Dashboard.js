import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Button } from "react-bootstrap";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import UserProgressBox from "./UserProgressBox";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const { getAccessToken } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const activePage = location.pathname.includes("personalized-path")
    ? "personalized-path"
    : "all-topics";

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setUser(profileResponse.data.user_data);
        setIsQuestionnaireCompleted(
          profileResponse.data.is_questionnaire_completed
        );
      } catch (error) {
        navigate("/login");
      }
    };

    const fetchUserProgress = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprogress/progress_summary/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setUserProgress(response.data);
      } catch (error) {
        console.error("Error fetching user progress:", error);
      }
    };

    fetchUserData();
    fetchUserProgress();
  }, [navigate, getAccessToken]);

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const isMobile = windowWidth < 768;

  return (
    <div className="dashboard">
      <div className="dashboard-main-wrapper">
        <div className="dashboard-content">
          <div className={`main-content ${isMobile ? "mb-4" : ""}`}>
            <div className="dashboard-header">
              <h2 className="dashboard-greeting">
                Welcome back, {user?.username || "User"}!
              </h2>
            </div>

            <div className="dashboard-buttons">
              <Button
                variant={
                  activePage === "all-topics" ? "accent" : "outline-accent"
                }
                onClick={() => navigate("/all-topics")}
                className="nav-btn"
                active={activePage === "all-topics"}
              >
                All Topics
              </Button>

              <Button
                variant={
                  activePage === "personalized-path"
                    ? "accent"
                    : isQuestionnaireCompleted
                    ? "outline-accent"
                    : "secondary"
                }
                onClick={() => {
                  if (isQuestionnaireCompleted) {
                    navigate("/personalized-path");
                  } else {
                    navigate("/questionnaire");
                  }
                }}
                className="nav-btn"
              >
                Personalized Path
                {!isQuestionnaireCompleted && " (Complete Questionnaire)"}
              </Button>
            </div>

            {activePage === "all-topics" ? (
              <AllTopics onCourseClick={handleCourseClick} />
            ) : (
              <PersonalizedPath onCourseClick={handleCourseClick} />
            )}
          </div>

          {!isMobile && (
            <div className="user-progress">
              <div className="user-progress-sticky-wrapper">
                {userProgress ? (
                  <UserProgressBox progressData={userProgress} />
                ) : (
                  <p>Loading progress...</p>
                )}
              </div>
            </div>
          )}
        </div>

        {isMobile && userProgress && (
          <div className="mobile-progress-section">
            <div className="container">
              <h4 className="mb-3">Your Learning Progress</h4>
              <UserProgressBox
                progressData={userProgress}
                initiallyExpanded={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
