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
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const handleAvatarChange = (newAvatarUrl) => {
    setImageUrl(newAvatarUrl);
  };

  const handleInputChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = async () => {
    try {
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/userprofile/update/`,
        {
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          username: profileData.username,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      setSaveStatus("success");
      setTimeout(() => setSaveStatus(""), 3000);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
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
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
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
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
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
              </div>

              <div className="two-column-layout gap-4 mb-4">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    readOnly={!isEditing}
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profileData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    readOnly={!isEditing}
                  />
                </div>
              </div>

              <div className="two-column-layout gap-4 mb-4">
                <div className="form-group">
                  <label>Username</label>
                  <div className="input-group">
                    <span className="input-group-text">@</span>
                    <input
                      type="text"
                      className="form-control"
                      value={profileData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      readOnly={!isEditing}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={profileData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    readOnly={!isEditing}
                  />
                </div>
              </div>

              <div className="d-flex gap-3 mt-4">
                {isEditing ? (
                  <>
                    <button className="btn btn-accent" onClick={handleSaveProfile}>
                      Save Changes
                    </button>
                    <button className="btn btn-outline-accent" onClick={() => setIsEditing(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn btn-accent" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </button>
                )}
              </div>

              {saveStatus === "success" && (
                <div className="alert alert-success mt-3">
                  Profile updated successfully!
                </div>
              )}

              {saveStatus === "error" && (
                <div className="alert alert-danger mt-3">
                  Error updating profile. Please try again.
                </div>
              )}

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
