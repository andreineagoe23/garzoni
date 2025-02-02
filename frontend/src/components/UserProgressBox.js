import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/UserProgressBox.css";

function UserProgressBox() {
  const [progressData, setProgressData] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true); // default expanded on desktop

  // Collapse by default on screens ≤ 768px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsExpanded(false);
      } else {
        setIsExpanded(true);
      }
    };

    // Run on mount
    handleResize();

    // Listen for window resize
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        // If the user is not logged in, do not fetch progress data
        return;
      }
      try {
        const response = await axios.get(
          "http://localhost:8000/api/userprogress/progress_summary/",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        setProgressData(response.data);
      } catch (error) {
        console.error("Error fetching progress data:", error);
      }
    };
    fetchProgress();
  }, []);

  if (!progressData) {
    return <div className="progress-box">Loading progress...</div>;
  }

  // Toggle function
  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="progress-box">
      {/* Collapsible Header */}
      <div className="progress-header" onClick={handleToggle}>
        <h3>User Progress</h3>
        <span className={`arrow ${isExpanded ? "arrow-up" : "arrow-down"}`} />
      </div>

      {/* Only show details if expanded */}
      {isExpanded && (
        <div className="progress-content">
          <h4>Overall Progress</h4>
          <div className="overall-progress">
            <p>{progressData.overall_progress.toFixed(1)}% Complete</p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressData.overall_progress}%` }}
              ></div>
            </div>
          </div>

          <h4>Learning Path Progress</h4>
          {progressData.paths.map((path, index) => (
            <div key={index} className="path-progress">
              <h5>
                {path.path} - {path.course}
              </h5>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${path.percent_complete}%` }}
                ></div>
              </div>
              <p>{path.percent_complete.toFixed(1)}% Complete</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserProgressBox;
