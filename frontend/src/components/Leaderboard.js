import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Leaderboard.css";
import Chatbot from "./Chatbot";

const Leaderboards = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/`,
          { withCredentials: true } // ✅ Use cookies for authentication
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
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="leaderboard-container">
      <div className="container">
        <h1 className="leaderboard-title text-center">Leaderboard</h1>
        <div className="table-responsive">
          <table className="table leaderboard-table text-center">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((userData, index) => (
                <tr
                  key={userData.user.id}
                  className={`rank-${
                    index === 0
                      ? "gold"
                      : index === 1
                      ? "silver"
                      : index === 2
                      ? "bronze"
                      : ""
                  }`}
                >
                  <td>{index + 1}</td>
                  <td>{userData.user.username}</td>
                  <td>{userData.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Chatbot />
    </div>
  );
};

export default Leaderboards;
