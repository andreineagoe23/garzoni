import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Profile.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0.0,
    points: 0,
    streak: 0,
  });
  const [imageUrl, setImageUrl] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchUserProgress = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprogress/`,
          { withCredentials: true }
        );

        setProfileData({
          username: response.data.username || "",
          email: response.data.email || "",
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
          earned_money: parseFloat(response.data.earned_money) || 0.0,
          points: response.data.points || 0,
          streak: response.data.streak || 0,
        });

        // Fetch avatar URL
        setImageUrl(response.data.avatar_url || "/default-avatar.png");

        // Fetch recent activity (mocked for now)
        setRecentActivity([
          {
            id: 1,
            activity: "Completed Basic Finance Course",
            date: "2025-01-10",
          },
          { id: 2, activity: "Earned 50 points", date: "2025-01-08" },
        ]);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    fetchUserProgress();
  }, []);

  // Replace hardcoded activity with real data
  useEffect(() => {
    const fetchActivity = async () => {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/userprogress/`,
        { withCredentials: true }
      );
      // Transform progress data into activity items
      setRecentActivity(
        response.data.map((p) => ({
          id: p.id,
          activity: `Completed ${p.course.title}`,
          date: new Date(p.last_completed_date).toLocaleDateString(),
        }))
      );
    };
    fetchActivity();
  }, []);

  return (
    <div className="container profile-container my-5">
      <div className="card p-4 shadow-sm">
        <h2 className="text-center mb-4">Profile</h2>

        <div className="text-center mb-4">
          <img
            src={imageUrl}
            alt="Avatar"
            className="rounded-circle"
            width="150"
            height="150"
          />
        </div>

        <div className="profile-details">
          <h3 className="mt-4 text-center">
            {profileData.first_name} {profileData.last_name}
          </h3>
          <p className="text-center text-muted">@{profileData.username}</p>
          <p className="text-center text-muted">{profileData.email}</p>

          <div className="stats-section">
            <div className="stat-box">
              <h4>Balance</h4>
              <p>${profileData.earned_money.toFixed(2)}</p>
            </div>
            <div className="stat-box">
              <h4>Points</h4>
              <p>{profileData.points}</p>
            </div>
            <div className="stat-box">
              <h4>Streak</h4>
              <p>{profileData.streak} days</p>
            </div>
          </div>
        </div>

        <h3 className="mt-4">Recent Activity</h3>
        <ul className="list-group">
          {recentActivity.map((activity) => (
            <li key={activity.id} className="list-group-item">
              <strong>{activity.activity}</strong>
              <span className="text-muted float-end">{activity.date}</span>
            </li>
          ))}
        </ul>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
