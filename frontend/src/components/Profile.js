import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";
import AvatarSelector from "./AvatarSelector";

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
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
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
          {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
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
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
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
      <div className="card p-4 shadow-lg">
        <h2 className="text-center mb-4 display-5 fw-bold">Profile</h2>

        <div className="text-center position-relative">
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
        </div>

        <div className="profile-details mt-4">
          <h3 className="text-center mb-2">
            {profileData.first_name} {profileData.last_name}
          </h3>
          <p className="text-center text-muted mb-1">@{profileData.username}</p>
          <p className="text-center text-muted">{profileData.email}</p>

          <div className="row g-4 mt-3">
            <div className="col-md-4 text-center">
              <div className="stat-box p-3">
                <h4 className="text-secondary mb-3">Balance</h4>
                <p className="h3 fw-bold">
                  ${profileData.earned_money.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="col-md-4 text-center">
              <div className="stat-box p-3">
                <h4 className="text-secondary mb-3">Points</h4>
                <p className="h3 fw-bold">{profileData.points}</p>
              </div>
            </div>
            <div className="col-md-4 text-center">
              <div className="stat-box p-3">
                <h4 className="text-secondary mb-3">Streak</h4>
                <p className="h3 fw-bold">{profileData.streak} days</p>
              </div>
            </div>
          </div>
        </div>

        <section className="badges-section mt-5">
          <h3 className="mb-4">Earned Badges</h3>
          <div className="d-flex flex-wrap gap-3 justify-content-center">
            {badges.length > 0 ? (
              badges.map((userBadge) => (
                <div key={userBadge.badge.id} className="badge-card">
                  <img
                    src={userBadge.badge.image_url}
                    alt={userBadge.badge.name}
                    className="badge-image img-fluid"
                  />
                  <p className="badge-name mt-2 mb-0">{userBadge.badge.name}</p>
                </div>
              ))
            ) : (
              <p className="text-muted">No badges earned yet</p>
            )}
          </div>
        </section>

        <section className="recent-activity mt-5">
          <h3 className="mb-4">Recent Activity</h3>
          <div className="list-group">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{formatActivityText(activity)}</strong>
                  </div>
                  <span className="text-muted text-nowrap">
                    {activity.timestamp}
                  </span>
                </div>
              ))
            ) : (
              <div className="list-group-item">No recent activity</div>
            )}
          </div>
        </section>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
