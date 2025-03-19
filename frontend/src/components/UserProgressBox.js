import React, { useState } from "react";
import "../styles/scss/main.scss";

function UserProgressBox({ progressData, initiallyExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

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
