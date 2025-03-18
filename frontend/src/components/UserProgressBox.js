import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/scss/main.scss";

function UserProgressBox() {
  const [progressData, setProgressData] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsExpanded(window.innerWidth > 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprogress/progress_summary/`,
          { withCredentials: true }
        );
        setProgressData(response.data);
      } catch (error) {
        console.error("Error fetching progress data:", error);
      }
    };
    fetchProgress();
  }, []);

  if (!progressData) {
    return (
      <div className="user-progress-box p-3 text-muted">
        Loading progress...
      </div>
    );
  }

  return (
    <div className="user-progress-box shadow-sm">
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
              <span className="fw-semibold">
                {progressData.overall_progress.toFixed(1)}%
              </span>
            </div>
            <div className="progress" style={{ height: "8px" }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: `${progressData.overall_progress}%`,
                  backgroundColor: "var(--primary)",
                }}
              />
            </div>
          </div>

          <h5 className="mb-3">Path Progress</h5>
          <div className="paths-container">
            {progressData.paths.map((path, index) => (
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
                <small className="text-muted d-block mt-1">{path.course}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProgressBox;
