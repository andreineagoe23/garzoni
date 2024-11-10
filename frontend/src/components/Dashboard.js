// src/components/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Dashboard() {
  const [user, setUser] = useState(null); // Holds user data
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login if not authenticated
    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      navigate("/login");
    } else {
      // Fetch user data (replace URL with actual endpoint)
      axios
        .get("http://localhost:8000/api/userprofile/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => setUser(response.data))
        .catch((error) => console.error("Failed to fetch user data:", error));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/"); // Redirect to Welcome page
  };

  return (
    <div className="dashboard">
      <h1>Welcome to Your Dashboard</h1>

      {/* Logout Button */}
      <button onClick={handleLogout}>Logout</button>

      {/* User Profile Info */}
      {user && (
        <div>
          <h2>
            Hello, {user.username}!
          </h2>
        </div>
      )}

      {/* Learning Paths Overview */}
      <div>
        <h3>Your Learning Paths</h3>
        <p>Explore and track your progress in the available paths below.</p>
        {/* TODO: Map through learning paths and show progress */}
      </div>

      {/* Progress Tracking */}
      <div>
        <h3>Progress</h3>
        <p>See how far you've come in each path.</p>
        {/* TODO: Map through user's progress for different courses */}
      </div>

      {/* Upcoming Content or Quizzes */}
      <div>
        <h3>Next Up</h3>
        <p>Continue your journey with the next module or quiz.</p>
        {/* TODO: Display upcoming content or quizzes */}
      </div>
    </div>
  );
}

export default Dashboard;
