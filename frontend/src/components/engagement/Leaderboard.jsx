import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PageContainer from "components/common/PageContainer";
import FriendRequests from "components/profile/FriendRequest";
import ReferralLink from "components/profile/ReferralLink";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const timeFilterOptions = [
  { value: "all-time", label: "All Time" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

const highlightClasses = [
  "bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border-amber-400/40",
  "bg-gradient-to-r from-slate-300/20 via-slate-200/10 to-transparent border-slate-300/40",
  "bg-gradient-to-r from-orange-400/10 via-amber-300/5 to-transparent border-orange-300/40",
];

const Leaderboards = () => {
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [activeTab, setActiveTab] = useState("global");
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [userRank, setUserRank] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const { getAccessToken, loadProfile } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const authHeaders = {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        };

        const [globalResponse, friendsResponse, rankResponse, profilePayload] =
          await Promise.all([
            axios.get(`${process.env.REACT_APP_BACKEND_URL}/leaderboard/`, {
              ...authHeaders,
              params: { time_filter: timeFilter },
            }),
            axios.get(
              `${process.env.REACT_APP_BACKEND_URL}/leaderboard/friends/`,
              authHeaders
            ),
            axios.get(
              `${process.env.REACT_APP_BACKEND_URL}/leaderboard/rank/`,
              authHeaders
            ),
            loadProfile(),
          ]);

        setGlobalLeaderboard(globalResponse.data);
        setFriendsLeaderboard(friendsResponse.data);
        setUserRank(rankResponse.data);
        setReferralCode(profilePayload?.referral_code || "");

        try {
          const sentRes = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/friend-requests/get_sent_requests/`,
            authHeaders
          );
          setSentRequests(sentRes.data);
        } catch (err) {
          console.warn("Unable to fetch sent requests", err);
          setSentRequests([]);
        }

        try {
          const friendsRes = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/friend-requests/get_friends/`,
            authHeaders
          );
          setFriends(friendsRes.data);
        } catch (err) {
          console.warn("Unable to fetch friends list", err);
          setFriends([]);
        }
      } catch (err) {
        console.error("Error fetching leaderboard data:", err);
        setError(
          err.response?.data?.detail ||
            "Failed to load leaderboard data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAccessToken, timeFilter, loadProfile]);

  const sendFriendRequest = async (receiverId) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/friend-requests/`,
        { receiver: receiverId },
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );

      const sentRequestsResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/friend-requests/get_sent_requests/`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      setSentRequests(sentRequestsResponse.data);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        "Failed to send friend request.";
      alert(message);
    }
  };

  const filteredLeaderboard = useMemo(() => {
    const source =
      activeTab === "global" ? globalLeaderboard : friendsLeaderboard;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return source;
    return source.filter((userData) =>
      userData.user.username.toLowerCase().includes(query)
    );
  }, [activeTab, globalLeaderboard, friendsLeaderboard, searchQuery]);

  const isAlreadyFriend = (userId) =>
    friends.some((friend) => friend.id === userId);

  const hasPendingRequest = (userId) =>
    sentRequests.some((request) => request.receiver.id === userId);

  if (loading) {
    return (
      <PageContainer layout="centered" maxWidth="4xl">
        <Loader message="Loading leaderboard data..." />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      maxWidth="7xl"
      layout="none"
      innerClassName="flex flex-col gap-10"
    >
        <header className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <GlassCard padding="md">
            <ReferralLink referralCode={referralCode} />
          </GlassCard>
          <GlassCard padding="md">
            <FriendRequests />
          </GlassCard>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
              {activeTab === "global" ? "Global Leaderboard" : "Friends Leaderboard"}
            </h1>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Track progress, celebrate wins, and connect with the community.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex overflow-hidden rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] p-1 text-sm shadow-sm">
              {["global", "friends"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-4 py-2 text-sm focus:ring-[color:var(--accent,#2563eb)]/40 ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/90 text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40"
                      : "border border-white/20 bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--accent,#2563eb)]/60 hover:bg-[color:var(--accent,#2563eb)]/10 hover:text-[color:var(--accent,#2563eb)]"
                  }`}
                >
                  {tab === "global" ? "Global" : "Friends"}
                </button>
              ))}
            </div>
            {activeTab === "global" && (
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value)}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)] shadow-sm focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                {timeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search users..."
              className="w-full rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-3 text-sm text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
              type="text"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[color:var(--muted-text,#6b7280)]">
              🔍
            </span>
          </div>
          {error && (
            <div className="rounded-3xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
              {error}
            </div>
          )}
        </div>

        {userRank &&
          !filteredLeaderboard.some(
            (entry) => entry.user.id === userRank.user.id
          ) && (
            <GlassCard padding="md" className="border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 shadow-[color:var(--accent,#2563eb)]/20">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent,#2563eb)] text-lg font-bold text-white shadow-md">
                  #{userRank.rank}
                </span>
                <div className="flex items-center gap-3">
                  {userRank.user.profile_avatar ? (
                    <img
                      src={userRank.user.profile_avatar}
                      alt={`${userRank.user.username}'s avatar`}
                      className="h-10 w-10 rounded-full border border-[color:var(--border-color,#d1d5db)] object-cover shadow-sm"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--card-bg,#ffffff)] text-sm font-semibold text-[color:var(--accent,#2563eb)] shadow-inner">
                      {userRank.user.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="text-sm">
                    <p className="font-semibold text-[color:var(--accent,#111827)]">
                      You ({userRank.user.username})
                    </p>
                    <p className="text-[color:var(--accent,#2563eb)]">
                      {userRank.points} points
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

        <div className="space-y-4">
          {filteredLeaderboard.length === 0 ? (
            <GlassCard padding="lg" className="text-center">
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                No users found for the current selection.
              </p>
            </GlassCard>
          ) : (
            filteredLeaderboard.map((entry, index) => {
              const position = index + 1;
              const isFriend = isAlreadyFriend(entry.user.id);
              const pending = hasPendingRequest(entry.user.id);
              const highlight =
                index < highlightClasses.length ? highlightClasses[index] : "";

              return (
                <GlassCard
                  key={entry.user.id}
                  padding="md"
                  className={`group flex flex-col gap-4 transition hover:-translate-y-1 ${highlight}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                  <div className="relative">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--input-bg,#f3f4f6)] text-sm font-semibold text-[color:var(--accent,#111827)]">
                      #{position}
                    </span>
                    <div className="flex items-center gap-3">
                      {entry.user.profile_avatar ? (
                        <img
                          src={entry.user.profile_avatar}
                          alt={`${entry.user.username}'s avatar`}
                          className="h-12 w-12 rounded-full border border-[color:var(--border-color,#d1d5db)] object-cover shadow-sm"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent,#2563eb)] text-base font-semibold text-white shadow-inner">
                          {entry.user.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="text-base font-semibold text-[color:var(--accent,#111827)]">
                          {entry.user.username}
                        </p>
                        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                          {entry.points.toLocaleString()} points
                        </p>
                      </div>
                    </div>
                    {activeTab === "global" && (
                      <button
                        type="button"
                        title={
                          isFriend
                            ? "Already friends"
                            : pending
                            ? "Request pending"
                            : "Add as friend"
                        }
                        onClick={() => sendFriendRequest(entry.user.id)}
                        disabled={isFriend || pending}
                        className={`ml-auto inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40 ${
                          isFriend
                            ? "cursor-not-allowed bg-emerald-500/10 text-emerald-500"
                            : pending
                            ? "cursor-not-allowed bg-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)]"
                            : "bg-[color:var(--primary,#2563eb)] text-white shadow hover:shadow-lg"
                        }`}
                      >
                        {isFriend ? "Friends" : pending ? "Pending" : "Add Friend"}
                      </button>
                    )}
                  </div>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
    </PageContainer>
  );
};

export default Leaderboards;
