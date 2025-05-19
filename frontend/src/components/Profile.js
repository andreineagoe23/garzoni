import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";
import AvatarSelector from "./AvatarSelector";
import { useAuth } from "./AuthContext";

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0,
    points: 0,
    streak: 0,
  });
  const [imageUrl, setImageUrl] = useState("/default-avatar.png");
  const [recentActivity, setRecentActivity] = useState([]);
  const [badges, setBadges] = useState([]);
  const { getAccessToken } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const handleAvatarChange = (newAvatarUrl) => {
    setImageUrl(newAvatarUrl);
  };

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        setProfileData({
          username: profileResponse.data.user_data.username || "",
          email: profileResponse.data.user_data.email || "",
          first_name: profileResponse.data.user_data.first_name || "",
          last_name: profileResponse.data.user_data.last_name || "",
          earned_money:
            parseFloat(profileResponse.data.user_data.earned_money) || 0,
          points: profileResponse.data.user_data.points || 0,
          streak: profileResponse.data.streak || 0,
        });

        setImageUrl(
          profileResponse.data.profile_avatar || "/default-avatar.png"
        );

        const activityResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/recent-activity/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
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
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        setBadges(badgesResponse.data);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    fetchProfileData();

    const handleNavToggle = (e) => {
      if (e.detail && typeof e.detail.isOpen === "boolean") {
        setIsNavOpen(e.detail.isOpen);
      }
    };

    window.addEventListener("navToggle", handleNavToggle);

    return () => {
      window.removeEventListener("navToggle", handleNavToggle);
    };
  }, [getAccessToken]);

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
    <div className={`profile-container ${isNavOpen ? "nav-open" : ""}`}>
      <div className="content-wrapper">
        <div className="form-layout-narrow">
          <div className="card">
            <div className="card-body">
              <h4 className="section-title mb-4">Profile Overview</h4>

              <div className="text-center position-relative mb-5">
                <div className="profile-avatar-container">
                  <img
                    src={imageUrl || "/default-avatar.png"}
                    alt="Avatar"
                    className="rounded-circle border-4 shadow-sm"
                    width="150"
                    height="150"
                  />
                  <AvatarSelector
                    currentAvatar={imageUrl}
                    onAvatarChange={handleAvatarChange}
                  />
                </div>

                {/* New user info section */}
                <div className="user-info-summary mt-4">
                  <h5 className="username-display mb-2">
                    @{profileData.username}
                  </h5>
                  <div className="name-email-display">
                    <p className="text-muted small">
                      {profileData.first_name} {profileData.last_name}
                    </p>
                    <p className="text-muted small">{profileData.email}</p>
                  </div>
                </div>
              </div>

              <h4 className="section-title mt-5 mb-4">Statistics</h4>

              <div className="three-column-layout gap-4 mb-5">
                <div className="stat-box text-center p-3">
                  <label className="stat-label mb-2">Balance</label>
                  <p className="stat-value">
                    ${profileData.earned_money.toFixed(2)}
                  </p>
                </div>

                <div className="stat-box text-center p-3">
                  <label className="stat-label mb-2">Points</label>
                  <p className="stat-value">{profileData.points}</p>
                </div>

                <div className="stat-box text-center p-3">
                  <label className="stat-label mb-2">Streak</label>
                  <p className="stat-value">{profileData.streak} days</p>
                  <div className="streak-status">
                    {profileData.streak >= 7 ? (
                      <span className="text-success">🔥 Hot streak!</span>
                    ) : profileData.streak >= 3 ? (
                      <span className="text-warning">↑ Keep going!</span>
                    ) : (
                      <span className="text-muted">Start your streak</span>
                    )}
                  </div>
                </div>
              </div>

              <h4 className="section-title mt-5 mb-4">Achievements</h4>
              <div className="card-grid-badges mb-5">
                {badges.length > 0 ? (
                  badges.map((userBadge) => (
                    <div key={userBadge.badge.id} className="badge-card">
                      <img
                        src={userBadge.badge.image_url}
                        alt={userBadge.badge.name}
                        className="badge-image img-fluid"
                      />
                      <p className="badge-name mt-2 mb-0">
                        {userBadge.badge.name}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No badges earned yet</p>
                )}
              </div>

              <h4 className="section-title mt-5 mb-4">Recent Activity</h4>
              <div className="activity-list">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-content">
                        <strong className="activity-text">
                          {formatActivityText(activity)}
                        </strong>
                        <span className="text-muted">{activity.timestamp}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No recent activity</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
