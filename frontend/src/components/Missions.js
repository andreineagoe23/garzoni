import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Missions.css";

function Missions() {
  const [missions, setMissions] = useState([]);
  const [message, setMessage] = useState("");

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
        setMissions(response.data);
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
      setMissions((prev) =>
        prev.map((mission) =>
          mission.id === missionId
            ? { ...mission, status: "completed" }
            : mission
        )
      );
    } catch (error) {
      console.error("Error completing mission:", error);
      setMessage("Failed to complete mission. Please try again.");
    }
  };

  return (
    <div className="container missions-container my-5">
      <h2 className="text-center mb-4">Missions</h2>
      {message && <p className="text-center text-success">{message}</p>}
      <div className="list-group">
        {missions.length > 0 ? (
          missions.map((mission) => (
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
          <p>No missions available. Check back later!</p>
        )}
      </div>
    </div>
  );
}

export default Missions;
