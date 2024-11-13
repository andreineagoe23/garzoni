import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import "../styles/Dashboard.css"; // Import the Dashboard page CSS

function Dashboard() {
  const [user, setUser] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
  const [activePathId, setActivePathId] = useState(null); // Track the currently active path
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      navigate("/login");
    } else {
      axios
        .get("http://localhost:8000/api/userprofiles/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          console.log("User profile response:", response.data); // Log response
          const userProfile = response.data[0]; // Access the first user profile in the array
          if (userProfile) {
            setUser(userProfile.user); // Extract and set the nested user object
          } else {
            console.error("No user profile found in the response.");
          }
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
    navigate("/");
  };

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const togglePath = (pathId) => {
    setActivePathId((prevPathId) => (prevPathId === pathId ? null : pathId)); // Toggle visibility
  };

  return (
    <div className="dashboard">
      <h1>Welcome to Your Dashboard</h1>
      <button onClick={handleLogout}>Logout</button>
      {user && <h2>Hello, {user.username}!</h2>}

      <div className="learning-path-container">
        <LearningPathList
          learningPaths={learningPaths}
          activePathId={activePathId}
          onTogglePath={togglePath}
          onCourseClick={handleCourseClick}
        />
      </div>
    </div>
  );
}

export default Dashboard;
