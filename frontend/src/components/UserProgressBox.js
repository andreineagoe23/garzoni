import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

function UserProgressBox({ progressData, initiallyExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { getAccessToken, logoutUser } = useAuth();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setUserProfile({
          points: response.data.user_data.points || 0,
          streak: response.data.streak || 0,
          username: response.data.user_data.username || "User",
        });
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [getAccessToken]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
      navigate("/login");
    }
  };

  if (!progressData) {
    return (
      <div className="user-progress-box p-3 text-muted">
        Loading progress...
      </div>
    );
  }

  // Safely access data with defaults to prevent errors
  const overallProgress = progressData?.overall_progress || 0;
  const paths = progressData?.paths || [];

  return (
    <div className="user-progress-box shadow-sm">
      {/* User Info Section */}
      <div className="user-info-section p-3 mb-0 border-bottom">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0 fw-semibold">User Profile</h5>
        </div>

        {loading ? (
          <p className="text-muted">Loading user info...</p>
        ) : (
          <div>
            <div className="user-stats d-flex justify-content-between mb-3">
              <div className="stats-item text-center">
                <span className="stats-value d-block fw-bold fs-4">
                  {userProfile?.points}
                </span>
                <span className="stats-label text-muted">Points</span>
              </div>

              <div className="stats-item text-center">
                <span className="stats-value d-block fw-bold fs-4">
                  {userProfile?.streak}
                </span>
                <span className="stats-label text-muted">
                  Day{userProfile?.streak !== 1 ? "s" : ""} Streak
                  {userProfile?.streak >= 5 && " 🔥"}
                </span>
              </div>
            </div>

            <div className="d-grid">
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="progress-header d-flex justify-content-between align-items-center p-3"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
      >
        <h3 className="m-0 fw-semibold">Learning Progress</h3>
        <i className={`bi bi-chevron-${isExpanded ? "up" : "down"} fs-5`} />
      </div>

      {isExpanded && (
        <div className="progress-content p-3">
          <div className="overall-progress mb-4">
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">Overall Completion</span>
              <span className="fw-semibold">{overallProgress.toFixed(1)}%</span>
            </div>
            <div className="progress" style={{ height: "8px" }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: `${overallProgress}%`,
                  backgroundColor: "var(--primary)",
                }}
              />
            </div>
          </div>

          {paths.length > 0 && (
            <>
              <h5 className="mb-3">Path Progress</h5>
              <div className="paths-container">
                {paths.map((path, index) => (
                  <div key={index} className="path-item mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">{path.path}</span>
                      <span className="fw-semibold">
                        {path.percent_complete.toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress" style={{ height: "6px" }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{
                          width: `${path.percent_complete}%`,
                          backgroundColor: "var(--accent)",
                        }}
                      />
                    </div>
                    <small className="text-muted d-block mt-1">
                      {path.course}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default UserProgressBox;
