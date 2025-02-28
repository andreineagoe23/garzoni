import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Leaderboard.css";
import FriendRequests from "./FriendRequest";
import ReferralLink from "./ReferralLink";

const Leaderboards = () => {
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [activeTab, setActiveTab] = useState("global"); // "global" or "friends"

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Global Leaderboard
        const globalResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/`,
          { withCredentials: true }
        );
        setGlobalLeaderboard(globalResponse.data);

        // Fetch Friends Leaderboard
        const friendsResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/friends/`,
          { withCredentials: true }
        );
        setFriendsLeaderboard(friendsResponse.data);

        // Fetch Referral Code
        const profileResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
          { withCredentials: true }
        );
        setReferralCode(profileResponse.data.referral_code);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sendFriendRequest = async (receiverId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/friend-requests/`,
        { receiver: receiverId },
        { withCredentials: true }
      );
      alert("Friend request sent!");
    } catch (err) {
      console.error("Error sending request:", err);
      alert(
        "Error sending request: " + (err.response?.data?.error || err.message)
      );
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Filter leaderboard data based on search query
  const filteredLeaderboard = (
    activeTab === "global" ? globalLeaderboard : friendsLeaderboard
  ).filter((userData) =>
    userData.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="leaderboard-container">
      <div className="container">
        {/* Header Section with Referral Link and Friend Requests Button */}
        <div className="leaderboard-header">
          <ReferralLink referralCode={referralCode} />
          <button
            className="btn btn-primary friend-request-btn"
            onClick={() => setShowFriendRequests(!showFriendRequests)}
          >
            {showFriendRequests
              ? "Hide Friend Requests"
              : "Show Friend Requests"}
          </button>
        </div>

        {/* Friend Requests Section - conditionally shown */}
        {showFriendRequests && <FriendRequests />}

        {/* Centralized Leaderboard Toggle */}
        <div className="leaderboard-toggle-container">
          <div className="leaderboard-toggle">
            <button
              onClick={() => setActiveTab("global")}
              className={activeTab === "global" ? "active" : ""}
            >
              Global Leaderboard
            </button>
            <button
              onClick={() => setActiveTab("friends")}
              className={activeTab === "friends" ? "active" : ""}
            >
              Friends Leaderboard
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
          />
        </div>

        {/* Leaderboard Title */}
        <h1 className="leaderboard-title text-center">
          {activeTab === "global"
            ? "Global Leaderboard"
            : "Friends Leaderboard"}
        </h1>

        {/* Leaderboard Table */}
        <div className="table-responsive">
          <table className="table leaderboard-table text-center">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Points</th>
                {activeTab === "global" && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeTab === "global" ? 4 : 3}
                    className="text-center"
                  >
                    No users found.
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
                    <td>{index + 1}</td>
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
