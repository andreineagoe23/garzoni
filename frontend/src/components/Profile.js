import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/scss/main.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";
import AvatarSelector from "./AvatarSelector";
import { useAuth } from "./AuthContext";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { OverlayTrigger, Tooltip, Spinner } from "react-bootstrap";
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from "react-vertical-timeline-component";
import "react-vertical-timeline-component/style.min.css";

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
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState({
    daily: {
      label: "Complete 1 lesson",
      current: 0,
      target: 1,
      completed: false,
    },
    weekly: {
      label: "Earn 500 points",
      current: 0,
      target: 500,
      completed: false,
    },
  });
  const [streakData, setStreakData] = useState([]);
  const { getAccessToken } = useAuth();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const activityIcons = {
    lesson: "📘",
    quiz: "🧠",
    mission: "🚀",
    course: "🎓",
    default: "📌",
  };

  const handleAvatarChange = (newAvatarUrl) => {
    setImageUrl(newAvatarUrl);
  };

  const generateStreakData = () => {
    const map = {};

    recentActivity.forEach((a) => {
      try {
        // Parse the timestamp string into a Date object
        const activityDate = new Date(a.timestamp);
        if (isNaN(activityDate.getTime())) {
          console.warn("Invalid date:", a.timestamp);
          return;
        }

        // Format the date as YYYY-MM-DD
        const date = activityDate.toISOString().split("T")[0];
        map[date] = (map[date] || 0) + 1;
      } catch (error) {
        console.warn("Error processing activity date:", error);
      }
    });

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 90); // last 90 days

    const data = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      data.push({
        date: dateStr,
        count: map[dateStr] || 0,
      });
    }

    setStreakData(data);
  };

  useEffect(() => {
    if (recentActivity.length > 0) {
      generateStreakData();
    }
  }, [recentActivity]);

  useEffect(() => {
    const fetchProfileData = async () => {
      setIsLoading(true);
      try {
        // Fetch user profile data
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

        // Fetch user activity
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

        // Update goals based on activity and points
        const today = new Date().toDateString();
        const todayActivities = formattedActivities.filter(
          (activity) => new Date(activity.timestamp).toDateString() === today
        );

        const dailyLessons = todayActivities.filter(
          (activity) => activity.type === "lesson"
        ).length;

        setGoals((prevGoals) => ({
          daily: {
            ...prevGoals.daily,
            current: dailyLessons,
            completed: dailyLessons >= prevGoals.daily.target,
          },
          weekly: {
            ...prevGoals.weekly,
            current: profileResponse.data.user_data.points % 500,
            completed: profileResponse.data.user_data.points >= 500,
          },
        }));

        // Fetch both earned and all available badges
        const [userBadgesResponse, allBadgesResponse] = await Promise.all([
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/user-badges/`, {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }),
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/badges/`, {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }),
        ]);

        // Create a map of user earned badges
        const earnedBadgesMap = {};
        userBadgesResponse.data.forEach((userBadge) => {
          earnedBadgesMap[userBadge.badge.id] = userBadge;
        });

        // Combine the data to show all badges with earned status
        const allBadgesWithStatus = allBadgesResponse.data.map((badge) => {
          const userBadge = earnedBadgesMap[badge.id];
          return {
            badge,
            earned: !!userBadge,
            earned_at: userBadge ? userBadge.earned_at : null,
          };
        });

        setBadges(allBadgesWithStatus);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setIsLoading(false);
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

  const renderBadgeTooltip = (badge) => (
    <Tooltip id={`tooltip-${badge.id}`}>
      <div className="badge-tooltip">
        <strong>{badge.name}</strong>
        <p className="mb-0">{badge.description || "Earned achievement"}</p>
        {badge.criteria_type && badge.threshold && (
          <small className="text-muted">
            {badge.criteria_type.replace("_", " ")}: {badge.threshold}
          </small>
        )}
      </div>
    </Tooltip>
  );

  if (isLoading) {
    return (
      <div className="profile-container d-flex justify-content-center align-items-center">
        <Spinner animation="border" role="status" className="my-5">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

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

              <h4 className="section-title mt-5 mb-4">Your Goals</h4>
              <div className="goal-tracker mb-5">
                <div
                  className={`goal-box mb-4 ${
                    goals.daily.completed ? "completed" : ""
                  }`}
                >
                  <h6 className="goal-label">🎯 Daily Goal</h6>
                  <p className="text-muted mb-1">{goals.daily.label}</p>
                  <div className="progress mb-2">
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{
                        width: `${Math.min(
                          100,
                          (goals.daily.current / goals.daily.target) * 100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <p className="small text-muted">
                    {Math.min(goals.daily.current, goals.daily.target)} /{" "}
                    {goals.daily.target}
                    {goals.daily.completed && (
                      <span className="text-success ms-2">✓ Completed!</span>
                    )}
                  </p>
                </div>

                <div
                  className={`goal-box ${
                    goals.weekly.completed ? "completed" : ""
                  }`}
                >
                  <h6 className="goal-label">🗓 Weekly Goal</h6>
                  <p className="text-muted mb-1">{goals.weekly.label}</p>
                  <div className="progress mb-2">
                    <div
                      className="progress-bar bg-info"
                      role="progressbar"
                      style={{
                        width: `${Math.min(
                          100,
                          (goals.weekly.current / goals.weekly.target) * 100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <p className="small text-muted">
                    {Math.min(goals.weekly.current, goals.weekly.target)} /{" "}
                    {goals.weekly.target}
                    {goals.weekly.completed && (
                      <span className="text-success ms-2">✓ Completed!</span>
                    )}
                  </p>
                </div>
              </div>

              <h4 className="section-title mt-5 mb-4">Learning Streak</h4>
              <div className="calendar-heatmap mb-5">
                <CalendarHeatmap
                  startDate={
                    new Date(new Date().setDate(new Date().getDate() - 90))
                  }
                  endDate={new Date()}
                  values={streakData}
                  classForValue={(value) => {
                    if (!value || value.count === 0) return "color-empty";
                    if (value.count === 1) return "color-scale-1";
                    if (value.count === 2) return "color-scale-2";
                    if (value.count >= 3) return "color-scale-3";
                    return "color-scale-4";
                  }}
                  tooltipDataAttrs={(value) =>
                    value.date
                      ? {
                          "data-tip": `${value.date}: ${value.count} activities`,
                        }
                      : {}
                  }
                  showWeekdayLabels
                />
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
              <div className="badges-container">
                <div className="card-grid-badges">
                  {badges.length > 0 ? (
                    badges.map((userBadge) => (
                      <OverlayTrigger
                        key={userBadge.badge.id}
                        placement="top"
                        overlay={renderBadgeTooltip(userBadge.badge)}
                      >
                        <div
                          className={`badge-card ${
                            !userBadge.earned ? "locked" : ""
                          }`}
                        >
                          <div className="badge-image-wrapper">
                            <img
                              src={userBadge.badge.image_url}
                              alt={userBadge.badge.name}
                              className={`badge-image img-fluid ${
                                !userBadge.earned ? "locked" : ""
                              }`}
                              style={{ opacity: userBadge.earned ? 1 : 0.4 }}
                            />
                            {!userBadge.earned && (
                              <div className="badge-lock-overlay">
                                <i className="fas fa-lock"></i>
                              </div>
                            )}
                          </div>
                          <p className="badge-name mt-2 mb-0">
                            {userBadge.earned ? userBadge.badge.name : "Locked"}
                          </p>
                          {userBadge.earned && userBadge.earned_at && (
                            <small className="text-muted">
                              Earned{" "}
                              {new Date(
                                userBadge.earned_at
                              ).toLocaleDateString()}
                            </small>
                          )}
                        </div>
                      </OverlayTrigger>
                    ))
                  ) : (
                    <p className="text-muted">No badges found</p>
                  )}
                </div>
              </div>

              <h4 className="section-title mt-5 mb-4">Recent Activity</h4>

              {recentActivity.length > 0 ? (
                <VerticalTimeline
                  layout="1-column-left"
                  lineColor="var(--border-color)"
                  className="profile-timeline"
                >
                  {/* Limit to 3 most recent activities */}
                  {recentActivity.slice(0, 3).map((activity) => (
                    <VerticalTimelineElement
                      key={activity.id}
                      className="vertical-timeline-element"
                      contentStyle={{
                        background: "var(--card-bg)",
                        color: "var(--text-color)",
                        borderRadius: "10px",
                        boxShadow: "0 0 10px rgba(0,0,0,0.05)",
                        padding: "16px",
                        border: "1px solid var(--border-color)",
                      }}
                      contentArrowStyle={{
                        borderRight: "7px solid var(--card-bg)",
                      }}
                      date={activity.timestamp}
                      dateClassName="timeline-date"
                      icon={
                        <span
                          style={{
                            fontSize: "1.25rem",
                            lineHeight: "2.5rem",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          {activityIcons[activity.type] ||
                            activityIcons.default}
                        </span>
                      }
                      iconStyle={{
                        background: "var(--primary)",
                        color: "#fff",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <h5 className="timeline-title mb-2">{activity.title}</h5>
                      <p className="timeline-text text-muted mb-0">
                        {activity.details ? `in ${activity.details}` : ""}
                      </p>
                    </VerticalTimelineElement>
                  ))}
                </VerticalTimeline>
              ) : (
                <p className="text-muted">No recent activity</p>
              )}

              {recentActivity.length > 3 && (
                <div className="text-center mt-3 mb-3">
                  <small className="text-muted">
                    Showing 3 most recent activities of {recentActivity.length}{" "}
                    total
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
