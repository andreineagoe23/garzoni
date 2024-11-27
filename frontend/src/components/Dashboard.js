import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import UserProgressBox from "./UserProgressBox";
import "../styles/Dashboard.css";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
  const [activePathId, setActivePathId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      navigate("/login");
    } else {
      axios
        .get("http://localhost:8000/api/userprofile/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          console.log("API Response:", response.data);
          setUser(response.data); // Directly set the user data
        })
        .catch((error) => console.error("Failed to fetch user data:", error));

      axios
        .get("http://localhost:8000/api/paths/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => setLearningPaths(response.data))
        .catch((error) =>
          console.error("Failed to fetch learning paths:", error)
        );
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/welcome");
  };

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const togglePath = (pathId) => {
    setActivePathId((prevPathId) => (prevPathId === pathId ? null : pathId));
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
