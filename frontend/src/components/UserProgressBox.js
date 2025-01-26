import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/UserProgressBox.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function UserProgressBox() {
  const [progressData, setProgressData] = useState(null);

  useEffect(() => {
    const fetchProgress = async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        return;
      }
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/userprogress/progress_summary/`,
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

  return (
    <div className="progress-box">
      <h3>Overall Progress</h3>
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
  );
}

export default UserProgressBox;
