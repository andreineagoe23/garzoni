import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Missions.css";
import Chatbot from "./Chatbot";

function Missions() {
  const [dailyMissions, setDailyMissions] = useState([]);
  const [monthlyMissions, setMonthlyMissions] = useState([]);
  const [message, setMessage] = useState("");
  const [timer, setTimer] = useState(""); // Countdown timer

  // Calculate time remaining for daily missions reset
  const calculateDailyTimer = () => {
    const now = new Date();
    const resetTime = new Date();
    resetTime.setHours(24, 0, 0, 0); // Reset at midnight
    const diff = resetTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    setTimer(`${hours}h ${minutes}m remaining`);
  };

  useEffect(() => {
    calculateDailyTimer();
    const interval = setInterval(calculateDailyTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchMissions = async () => {
      const token = localStorage.getItem("accessToken");
      try {
        const response = await axios.get(
          "http://localhost:8000/api/missions/",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDailyMissions(response.data.daily);
        setMonthlyMissions(response.data.monthly);
      } catch (error) {
        console.error("Error fetching missions:", error);
        setMessage("Failed to load missions. Please try again later.");
      }
    };

    fetchMissions();
  }, []);

  const handleCompleteMission = async (missionId) => {
    const token = localStorage.getItem("accessToken");
    try {
      const response = await axios.post(
        `http://localhost:8000/api/missions/${missionId}/complete/`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage(response.data.message);

      // Re-fetch missions to update their status
      const fetchMissions = async () => {
        try {
          const response = await axios.get(
            "http://localhost:8000/api/missions/",
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setDailyMissions(response.data.daily);
          setMonthlyMissions(response.data.monthly);
        } catch (error) {
          console.error("Error fetching missions:", error);
          setMessage("Failed to load missions. Please try again later.");
        }
      };

      fetchMissions(); // Refresh the missions after completing one
    } catch (error) {
      console.error("Error completing mission:", error);
      setMessage("Failed to complete mission. Please try again.");
    }
  };

  return (
    <div className="container missions-container my-5">
      <h2 className="text-center mb-4">Missions</h2>
      {message && <p className="text-center text-success">{message}</p>}

      <div className="missions-section">
        <h3>Daily Missions</h3>
        <p className="text-muted">Reset in: {timer}</p>
        <div className="list-group">
          {dailyMissions.length > 0 ? (
            dailyMissions.map((mission) => (
              <div
                key={mission.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div>
                  <h5>{mission.name}</h5>
                  <p>{mission.description}</p>
                  <small>Status: {mission.status}</small>
                </div>
                {mission.status !== "completed" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleCompleteMission(mission.id)}
                  >
                    Complete Mission
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No daily missions available. Check back later!</p>
          )}
        </div>
      </div>

      <div className="missions-section mt-5">
        <h3>Monthly Missions</h3>
        <div className="list-group">
          {monthlyMissions.length > 0 ? (
            monthlyMissions.map((mission) => (
              <div
                key={mission.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div>
                  <h5>{mission.name}</h5>
                  <p>{mission.description}</p>
                  <small>Status: {mission.status}</small>
                </div>
                {mission.status !== "completed" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleCompleteMission(mission.id)}
                  >
                    Complete Mission
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No monthly missions available. Check back later!</p>
          )}
        </div>
      </div>
      <Chatbot />
    </div>
  );
}

export default Missions;
