import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import UserProgressBox from "./UserProgressBox";
import "../styles/Dashboard.css";

function Dashboard() {
  const [user, setUser] = useState(null); // For user info
  const [learningPaths, setLearningPaths] = useState([]); // For paths list
  const [activePathId, setActivePathId] = useState(null); // Tracks selected path
  const [recommendedPath, setRecommendedPath] = useState(null); // Recommendation
  const [showRecommendation, setShowRecommendation] = useState(true); // Toggle recommendation display
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login");
    } else {
      // Fetch user info
      axios
        .get("http://localhost:8000/api/userprofile/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => setUser(response.data))
        .catch((error) => console.error("Failed to fetch user data:", error));

      // Fetch learning paths
      axios
        .get("http://localhost:8000/api/paths/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => setLearningPaths(response.data))
        .catch((error) =>
          console.error("Failed to fetch learning paths:", error)
        );

      // Fetch questionnaire data and determine recommended path
      axios
        .get("http://localhost:8000/api/questionnaire/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          const { question1, question2, question3 } = response.data;

          // Personalized recommendation logic
          if (question1 === "Save and budget effectively") {
            setRecommendedPath("Basic Finance");
          } else if (
            question1 === "Start investing" &&
            question2 === "Beginner"
          ) {
            setRecommendedPath("Basic Finance");
          } else if (question1 === "Achieve financial independence") {
            setRecommendedPath("Real Estate");
          } else if (question3 === "Interactive and hands-on") {
            setRecommendedPath("Crypto");
          } else if (question2 === "Advanced") {
            setRecommendedPath("Forex");
          } else {
            setRecommendedPath("General Financial Literacy");
          }

          // Hide recommendation after 10 seconds
          setTimeout(() => setShowRecommendation(false), 10000);
        })
        .catch((error) =>
          console.error("Failed to fetch questionnaire data:", error)
        );
    }
  }, [navigate]);

  const togglePath = (pathId) => {
    setActivePathId((prevPathId) => (prevPathId === pathId ? null : pathId));
  };

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/welcome");
  };

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="dashboard-container">
          <div className="main-section">
            <h1>Welcome to Your Dashboard</h1>
            <button onClick={handleLogout} className="btn btn-danger">
              Logout
            </button>
            {user ? <h2>Hello, {user.username}!</h2> : <h2>Loading...</h2>}

            {showRecommendation && recommendedPath && (
              <p className="recommendation-message">
                Based on your answers, we recommend starting with:{" "}
                <strong>{recommendedPath}</strong>
              </p>
            )}

            <div className="learning-path-container">
              <LearningPathList
                learningPaths={learningPaths}
                activePathId={activePathId}
                onTogglePath={togglePath}
                onCourseClick={handleCourseClick}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="user-progress">
        <UserProgressBox />
      </div>
    </div>
  );
}

export default Dashboard;
