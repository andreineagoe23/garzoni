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
  const [badges, setBadges] = useState([]);
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          { withCredentials: true }
        );

        setProfileData({
          username: profileResponse.data.user_data.username || "",
          email: profileResponse.data.user_data.email || "",
          first_name: profileResponse.data.user_data.first_name || "",
          last_name: profileResponse.data.user_data.last_name || "",
          earned_money:
            parseFloat(profileResponse.data.user_data.earned_money) || 0.0,
          points: profileResponse.data.user_data.points || 0,
          streak: profileResponse.data.streak || 0,
        });

        setImageUrl(
          profileResponse.data.profile_avatar || "/default-avatar.png"
        );

        const activityResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/recent-activity/`,
          { withCredentials: true }
        );

        const formattedActivities = activityResponse.data.recent_activities.map(
          (activity) => ({
            id: `${activity.type}-${activity.timestamp}`,
            type: activity.type,
            title: activity.title || activity.name,
            action: activity.action,
            timestamp: new Date(activity.timestamp).toLocaleString(),
            details: activity.course ? `in ${activity.course}` : "",
          })
        );

        setRecentActivity(formattedActivities);

        const badgesResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/user-badges/`,
          { withCredentials: true }
        );

        setBadges(badgesResponse.data);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    fetchProfileData();

    // Listen for navbar toggle events
    const handleNavToggle = (e) => {
      if (e.detail && typeof e.detail.isOpen === "boolean") {
        setIsNavOpen(e.detail.isOpen);
      }
    };

    window.addEventListener("navToggle", handleNavToggle);

    return () => {
      window.removeEventListener("navToggle", handleNavToggle);
    };
  }, []);

  const formatActivityText = (activity) => {
    switch (activity.type) {
      case "lesson":
        return `Completed lesson: ${activity.title} ${activity.details}`;
      case "quiz":
        return `Completed quiz: ${activity.title}`;
      case "mission":
        return `Completed mission: ${activity.title}`;
      case "course":
        return `Completed course: ${activity.title}`;
      default:
        return `Activity: ${activity.title}`;
    }
  };

  return (
    <div
      className={`container profile-container my-5 ${
        isNavOpen ? "nav-open" : ""
      }`}
    >
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

        <h3 className="mt-4">Earned Badges</h3>
        <div className="badges-section d-flex flex-wrap justify-content-center">
          {badges.length > 0 ? (
            badges.map((userBadge) => (
              <div key={userBadge.badge.id} className="badge-card">
                <img
                  src={userBadge.badge.image_url}
                  alt={userBadge.badge.name}
                  className="badge-image"
                />
                <p className="badge-name">{userBadge.badge.name}</p>
              </div>
            ))
          ) : (
            <p>No badges earned yet</p>
          )}
        </div>

        <h3 className="mt-4">Recent Activity</h3>
        <ul className="list-group">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <li key={activity.id} className="list-group-item">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div>
                    <strong>{formatActivityText(activity)}</strong>
                  </div>
                  <span className="text-muted">{activity.timestamp}</span>
                </div>
              </li>
            ))
          ) : (
            <li className="list-group-item">No recent activity</li>
          )}
        </ul>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
