import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Button } from "react-bootstrap";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
import UserProgressBox from "./UserProgressBox";
import Navbar from "./Navbar";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

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
          { withCredentials: true }
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

  const isMobile = windowWidth < 768;

  return (
    <div className="dashboard">
      <Navbar />

      <div className="dashboard-main-wrapper">
        <div className="dashboard-content">
          <div className={`main-content ${isMobile ? "mb-4" : ""}`}>
            <div className="dashboard-header">
              <h2 className="dashboard-greeting">
                Welcome back, {user?.username || "User"}!
              </h2>
              <Button
                variant="danger"
                onClick={handleLogout}
                className="logout-btn"
              >
                Logout
              </Button>
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

        {/* Mobile progress panel at bottom for small screens */}
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
