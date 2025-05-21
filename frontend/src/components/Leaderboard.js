import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/scss/main.scss";
import FriendRequests from "./FriendRequest";
import ReferralLink from "./ReferralLink";
import { useAuth } from "./AuthContext";

const Leaderboards = () => {
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [activeTab, setActiveTab] = useState("global");
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Global Leaderboard
        const globalResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setGlobalLeaderboard(globalResponse.data);

        // Fetch Friends Leaderboard
        const friendsResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/friends/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setFriendsLeaderboard(friendsResponse.data);

        // Fetch Referral Code
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setReferralCode(profileResponse.data.referral_code);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAccessToken]);

  const sendFriendRequest = async (receiverId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/friend-requests/`,
        { receiver: receiverId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      alert("Friend request sent!");
    } catch (err) {
      console.error("Error sending request:", err);
      alert(
        "Error sending request: " + (err.response?.data?.error || err.message)
      );
    }
  };

  const filteredLeaderboard = (
    activeTab === "global" ? globalLeaderboard : friendsLeaderboard
  ).filter((userData) =>
    userData.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-container content-wrapper">
      <div className="container">
        <div className="dashboard-top-section two-column-layout">
          <div className="column-main">
            <div className="referral-container">
              <ReferralLink referralCode={referralCode} />
            </div>
          </div>

          <div className="column-side">
            <div className="friend-requests-container">
              <div className="friend-requests-header"></div>
              <FriendRequests />
            </div>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control mx-auto"
          />
        </div>

        <h1 className="leaderboard-title">
          {activeTab === "global"
            ? "Global Leaderboard"
            : "Friends Leaderboard"}
        </h1>

        <div className="leaderboard-toggle-container">
          <div className="leaderboard-toggle btn-group" role="group">
            <button
              onClick={() => setActiveTab("global")}
              className={`btn ${
                activeTab === "global"
                  ? "btn-primary active"
                  : "btn-outline-primary"
              }`}
            >
              Global
            </button>
            <button
              onClick={() => setActiveTab("friends")}
              className={`btn ${
                activeTab === "friends"
                  ? "btn-primary active"
                  : "btn-outline-primary"
              }`}
            >
              Friends
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table leaderboard-table">
            <thead className="table-header">
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Username</th>
                <th scope="col">Points</th>
                {activeTab === "global" && <th scope="col">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeTab === "global" ? 4 : 3}
                    className="text-center py-4"
                  >
                    <span className="text-muted">No users found</span>
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((userData, index) => (
                  <tr
                    key={userData.user.id}
                    className={
                      index === 0
                        ? "rank-gold"
                        : index === 1
                        ? "rank-silver"
                        : index === 2
                        ? "rank-bronze"
                        : ""
                    }
                  >
                    <td className="fw-bold">{index + 1}</td>
                    <td>{userData.user.username}</td>
                    <td>{userData.points}</td>
                    {activeTab === "global" && (
                      <td>
                        <button
                          onClick={() => sendFriendRequest(userData.user.id)}
                          className="btn btn-sm btn-primary"
                        >
                          Add Friend
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboards;
