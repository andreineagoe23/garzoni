import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Leaderboard.css";

const Leaderboards = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const token = localStorage.getItem("accessToken");

        if (!token) {
          console.log("No token found, user needs to log in.");
          return;
        }

        const response = await axios.get(
          "http://localhost:8000/api/leaderboard/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setLeaderboard(response.data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>; // Styled loading message
  }

  return (
    <div className="container my-5">
      <h1 className="text-center mb-4">Leaderboard</h1>
      <div className="table-responsive">
        <table className="table table-bordered table-hover text-center">
          <thead className="table-light">
            <tr>
              <th>Rank</th>
              <th>Username</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((userData, index) => (
              <tr key={userData.user.id}>
                <td>{index + 1}</td>
                <td>{userData.user.username}</td>
                <td>{userData.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboards;
