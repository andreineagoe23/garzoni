import React, { useState, useEffect } from "react";
import axios from "axios";
import ProgressBar from "react-bootstrap/ProgressBar";
import "../styles/Missions.css";

function Missions() {
  const [dailyMissions, setDailyMissions] = useState([]);
  const [weeklyMissions, setWeeklyMissions] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch missions periodically
  useEffect(() => {
    const fetchMissions = async () => {
      const token = localStorage.getItem("accessToken");
      try {
        const response = await axios.get(
          "http://localhost:8000/api/missions/",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setDailyMissions(response.data.daily || []);
        setWeeklyMissions(response.data.weekly || []);
      } catch (error) {
        console.error("Error fetching missions:", error);
        setErrorMessage("Failed to load missions. Please try again.");
      }
    };

    fetchMissions();

    // Periodically update missions every 30 seconds
    const intervalId = setInterval(fetchMissions, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const renderMission = (mission) => (
    <div key={mission.id} className="mission-card">
      <div className="mission-header">
        <h5>{mission.name}</h5>
        <p>{mission.description}</p>
      </div>
      <ProgressBar now={mission.progress} label={`${mission.progress}%`} />
      {mission.status === "completed" && (
        <p className="completed-badge">Completed!</p>
      )}
    </div>
  );

  return (
    <div className="container missions-container">
      <h2 className="text-center">Missions</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="missions-section">
        <h3>Daily Missions</h3>
        <div className="missions-list">
          {dailyMissions.length > 0 ? (
            dailyMissions.map(renderMission)
          ) : (
            <p>No daily missions available. Check back later!</p>
          )}
        </div>
      </div>

      <div className="missions-section mt-5">
        <h3>Weekly Missions</h3>
        <div className="missions-list">
          {weeklyMissions.length > 0 ? (
            weeklyMissions.map(renderMission)
          ) : (
            <p>No weekly missions available. Check back later!</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Missions;
