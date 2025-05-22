import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/scss/main.scss";
import FriendRequests from "./FriendRequest";
import ReferralLink from "./ReferralLink";
import { useAuth } from "./AuthContext";
import { Tooltip, OverlayTrigger } from "react-bootstrap";

const Leaderboards = () => {
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [activeTab, setActiveTab] = useState("global");
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [userRank, setUserRank] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const { getAccessToken } = useAuth();

  const timeFilterOptions = [
    { value: "all-time", label: "All Time" },
    { value: "month", label: "This Month" },
    { value: "week", label: "This Week" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch Global Leaderboard with time filter
        const globalResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
            params: {
              time_filter: timeFilter,
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

        // Fetch User Rank
        const rankResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/leaderboard/rank/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setUserRank(rankResponse.data);

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

        try {
          // Fetch sent friend requests
          const sentRequestsResponse = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/friend-requests/get_sent_requests/`,
            {
              headers: {
                Authorization: `Bearer ${getAccessToken()}`,
              },
            }
          );
          setSentRequests(sentRequestsResponse.data);
        } catch (error) {
          console.log("Could not fetch sent requests:", error.message);
          setSentRequests([]);
        }

        try {
          // Fetch friends
          const friendsListResponse = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/friend-requests/get_friends/`,
            {
              headers: {
                Authorization: `Bearer ${getAccessToken()}`,
              },
            }
          );
          setFriends(friendsListResponse.data);
        } catch (error) {
          console.log("Could not fetch friends list:", error.message);
          setFriends([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAccessToken, timeFilter]);

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

      try {
        // Update sent requests list
        const sentRequestsResponse = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/friend-requests/get_sent_requests/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setSentRequests(sentRequestsResponse.data);
      } catch (error) {
        console.log("Could not refresh sent requests:", error.message);
      }
    } catch (err) {
      console.error("Error sending request:", err);
      const errorMessage = err.response?.data?.error || err.message;
      alert("Error sending request: " + errorMessage);
    }
  };

  const filteredLeaderboard = (
    activeTab === "global" ? globalLeaderboard : friendsLeaderboard
  ).filter((userData) =>
    userData.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if a user is already a friend or has a pending request
  const isAlreadyFriend = (userId) => {
    return friends.some((friend) => friend.id === userId);
  };

  const hasPendingRequest = (userId) => {
    return sentRequests.some((request) => request.receiver.id === userId);
  };

  // Get the appropriate button tooltip
  const getAddFriendTooltip = (userId) => {
    if (isAlreadyFriend(userId)) return "Already friends";
    if (hasPendingRequest(userId)) return "Request pending";
    return "Add as friend";
  };

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
    <div className="leaderboard-container">
      <div className="leaderboard-content">
        <div className="dashboard-top-section">
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

        <div className="leaderboard-controls">
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

          {activeTab === "global" && (
            <div className="time-filter-container">
              <select
                className="form-select"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                {timeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {userRank &&
          !filteredLeaderboard.some(
            (data) => data.user.id === userRank.user.id
          ) && (
            <div className="current-user-rank">
              <div className="card">
                <div className="card-body d-flex align-items-center">
                  <div className="rank-number">{userRank.rank}</div>
                  <div className="user-avatar-container">
                    {userRank.user.profile_avatar ? (
                      <img
                        src={userRank.user.profile_avatar}
                        alt={`${userRank.user.username}'s avatar`}
                        className="avatar-sm"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {userRank.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-info">
                    <div className="username">
                      You ({userRank.user.username})
                    </div>
                    <div className="points">{userRank.points} points</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        <div className="table-responsive">
          <table className="table leaderboard-table">
            <thead className="table-header">
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">User</th>
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
                    <td className="d-flex align-items-center">
                      {userData.user.profile_avatar ? (
                        <img
                          src={userData.user.profile_avatar}
                          alt={`${userData.user.username}'s avatar`}
                          className="avatar-sm me-2"
                        />
                      ) : (
                        <div className="avatar-placeholder me-2">
                          {userData.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {userData.user.username}
                    </td>
                    <td>{userData.points}</td>
                    {activeTab === "global" && (
                      <td>
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip>
                              {getAddFriendTooltip(userData.user.id)}
                            </Tooltip>
                          }
                        >
                          <span className="d-inline-block">
                            <button
                              onClick={() =>
                                sendFriendRequest(userData.user.id)
                              }
                              className="btn btn-sm btn-primary"
                              disabled={
                                isAlreadyFriend(userData.user.id) ||
                                hasPendingRequest(userData.user.id)
                              }
                            >
                              {isAlreadyFriend(userData.user.id)
                                ? "Friends"
                                : hasPendingRequest(userData.user.id)
                                ? "Pending"
                                : "Add Friend"}
                            </button>
                          </span>
                        </OverlayTrigger>
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
