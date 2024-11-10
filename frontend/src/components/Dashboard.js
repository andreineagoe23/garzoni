// src/components/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
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
        .then((response) => setUser(response.data))
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

  return (
    <div className="dashboard">
      <h1>Welcome to Your Dashboard</h1>
      <button onClick={handleLogout}>Logout</button>
      {user && <h2>Hello, {user.username}!</h2>}

      {/* Learning Paths Section */}
      <LearningPathList learningPaths={learningPaths} />
    </div>
  );
}

export default Dashboard;
