import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cx from "classnames";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import PageContainer from "components/common/PageContainer";
import FriendRequests from "components/profile/FriendRequest";
import ReferralLink from "components/profile/ReferralLink";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import apiClient from "services/httpClient";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import { formatNumber, getLocale } from "utils/format";
import { useTranslation } from "react-i18next";

type LeaderboardUser = {
  id: number;
  username: string;
  profile_avatar?: string | null;
};

type LeaderboardEntry = {
  user: LeaderboardUser;
  points: number;
  rank?: number;
};

type Friend = {
  id: number;
};

type SentRequest = {
  receiver: { id: number };
};

const LIST_PAGE_SIZE = 25;

const podiumHighlight = [
  "border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-amber-400/10 to-transparent shadow-lg shadow-amber-500/10",
  "border-slate-300/50 bg-gradient-to-b from-slate-200/25 via-slate-100/10 to-transparent shadow-md",
  "border-orange-300/50 bg-gradient-to-b from-orange-400/15 via-amber-200/10 to-transparent shadow-md",
];

const listHighlightClasses = [
  "bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border-amber-400/40",
  "bg-gradient-to-r from-slate-300/20 via-slate-200/10 to-transparent border-slate-300/40",
  "bg-gradient-to-r from-orange-400/10 via-amber-300/5 to-transparent border-orange-300/40",
];

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"] as const;

function friendActionButtonClass(isFriend: boolean, pending: boolean) {
  return cx(
    "ml-auto inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#ffd700)]/40",
    isFriend &&
      "cursor-not-allowed bg-emerald-500/10 text-[color:var(--accent,#ffd700)]",
    pending &&
      !isFriend &&
      "cursor-not-allowed bg-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)]",
    !isFriend &&
      !pending &&
      "bg-[color:var(--primary,#1d5330)] text-white shadow hover:shadow-lg"
  );
}

const Leaderboards = () => {
  const locale = getLocale();
  const { t } = useTranslation();
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [stableReady, setStableReady] = useState(false);
  const [globalReady, setGlobalReady] = useState(false);
  const [globalBusy, setGlobalBusy] = useState(false);
  const globalLoadedOnce = useRef(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [activeTab, setActiveTab] = useState<"global" | "friends">("global");
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [listVisible, setListVisible] = useState(LIST_PAGE_SIZE);
  const { loadProfile, user, profile } = useAuth();

  const currentUserId = useMemo(() => {
    const id = profile?.id ?? user?.id;
    if (id === undefined || id === null) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [profile?.id, user?.id]);

  const timeFilterOptions = useMemo(
    () => [
      { value: "all-time", label: t("leaderboard.time.allTime") },
      { value: "month", label: t("leaderboard.time.thisMonth") },
      { value: "week", label: t("leaderboard.time.thisWeek") },
    ],
    [t]
  );

  const fetchGlobalLeaderboard = useCallback(async () => {
    const res = await apiClient.get("/leaderboard/", {
      params: { time_filter: timeFilter },
    });
    return res.data as LeaderboardEntry[];
  }, [timeFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStableReady(false);
        setError("");
        const [friendsResponse, rankResponse, profilePayload, sentRes, friendsRes] =
          await Promise.all([
            apiClient.get("/leaderboard/friends/"),
            apiClient.get("/leaderboard/rank/"),
            loadProfile(),
            apiClient
              .get("/friend-requests/get_sent_requests/")
              .catch(() => ({ data: [] as SentRequest[] })),
            apiClient
              .get("/friend-requests/get_friends/")
              .catch(() => ({ data: [] as Friend[] })),
          ]);
        if (cancelled) return;
        setFriendsLeaderboard(friendsResponse.data);
        setUserRank(rankResponse.data);
        const resolvedReferralCode =
          (typeof profilePayload?.referral_code === "string" &&
            profilePayload.referral_code) ||
          (typeof (
            profilePayload?.user_data as { referral_code?: string } | undefined
          )?.referral_code === "string" &&
            (
              profilePayload?.user_data as
                | { referral_code?: string }
                | undefined
            )?.referral_code) ||
          "";
        setReferralCode(resolvedReferralCode);
        setSentRequests(sentRes.data);
        setFriends(friendsRes.data);
        setStableReady(true);
      } catch (err: unknown) {
        console.error("Error fetching leaderboard (stable) data:", err);
        const detail = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        if (!cancelled) {
          setError(detail || t("leaderboard.errors.loadFailed"));
          setStableReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (globalLoadedOnce.current) setGlobalBusy(true);
      try {
        const data = await fetchGlobalLeaderboard();
        if (!cancelled) setGlobalLeaderboard(data);
      } catch (err: unknown) {
        console.error("Error fetching global leaderboard:", err);
        const detail = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        if (!cancelled)
          setError(detail || t("leaderboard.errors.loadFailed"));
      } finally {
        if (!cancelled) {
          setGlobalBusy(false);
          setGlobalReady(true);
          globalLoadedOnce.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchGlobalLeaderboard, t]);

  const sendFriendRequest = async (receiverId: number) => {
    try {
      await apiClient.post("/friend-requests/", { receiver: receiverId });
      const sentRequestsResponse = await apiClient.get(
        "/friend-requests/get_sent_requests/"
      );
      setSentRequests(sentRequestsResponse.data);
      toast.success(t("leaderboard.friendRequestSent"));
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string; detail?: string } };
        message?: string;
      };
      const message =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.message ||
        t("leaderboard.errors.friendRequestFailed");
      toast.error(message);
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

  useEffect(() => {
    setListVisible(LIST_PAGE_SIZE);
  }, [searchQuery, activeTab, timeFilter]);

  const podiumEntries = useMemo(
    () => filteredLeaderboard.slice(0, Math.min(3, filteredLeaderboard.length)),
    [filteredLeaderboard]
  );

  const listRemainder = useMemo(() => {
    if (filteredLeaderboard.length <= 3) return [];
    return filteredLeaderboard.slice(3);
  }, [filteredLeaderboard]);

  const visibleRemainder = useMemo(
    () => listRemainder.slice(0, listVisible),
    [listRemainder, listVisible]
  );

  const hasMoreList = listRemainder.length > listVisible;

  const isAlreadyFriend = (userId: number) =>
    friends.some((friend) => friend.id === userId);

  const hasPendingRequest = (userId: number) =>
    sentRequests.some((request) => request.receiver.id === userId);

  const pageLoading = !stableReady || !globalReady;

  const podiumOrder = useMemo((): LeaderboardEntry[] => {
    const [a, b, c] = podiumEntries;
    if (podiumEntries.length === 3 && a && b && c) return [b, a, c];
    if (podiumEntries.length === 2 && a && b) return [b, a];
    return podiumEntries;
  }, [podiumEntries]);

  if (pageLoading) {
    return (
      <PageContainer layout="centered" maxWidth="4xl">
        <Loader message={t("leaderboard.loading")} />
      </PageContainer>
    );
  }

  const rankForEntry = (entry: LeaderboardEntry, fallbackRank: number) =>
    entry.rank ?? fallbackRank;

  const renderPodium = () => {
    if (podiumEntries.length === 0) return null;

    const placeLabel = (place: number) =>
      place === 1
        ? t("leaderboard.podium.place1")
        : place === 2
          ? t("leaderboard.podium.place2")
          : t("leaderboard.podium.place3");

    return (
      <div
        className={cx(
          "mb-8 flex flex-col items-stretch gap-4 md:flex-row md:items-end md:justify-center md:gap-6",
          podiumEntries.length === 1 && "md:justify-center"
        )}
      >
        {podiumOrder.map((entry) => {
          const idxInTopThree = podiumEntries.indexOf(entry);
          const rank = rankForEntry(entry, idxInTopThree + 1);
          const medal = MEDAL_EMOJI[idxInTopThree] ?? "";
          const isYou =
            currentUserId !== null && entry.user.id === currentUserId;
          return (
            <GlassCard
              key={entry.user.id}
              padding="md"
              className={cx(
                "relative w-full min-h-[260px] overflow-hidden border-2 transition hover:-translate-y-0.5 md:w-[220px]",
                podiumHighlight[idxInTopThree] ?? podiumHighlight[2],
                isYou &&
                  "ring-2 ring-[color:var(--accent,#ffd700)] ring-offset-2 ring-offset-[color:var(--card-bg,#ffffff)]",
                rank === 2 && "md:order-1",
                rank === 1 && "md:z-10 md:order-2",
                rank === 3 && "md:order-3"
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--accent,#ffd700)]/8 via-transparent to-transparent" />
              <div className="relative flex flex-col items-center gap-3 text-center">
                <span
                  className="text-4xl leading-none"
                  role="img"
                  aria-label={placeLabel(rank)}
                >
                  {medal}
                </span>
                <span
                  className={cx(
                    "inline-flex min-h-[3rem] min-w-[3rem] items-center justify-center rounded-full font-bold text-white shadow-md",
                    rank === 1 && "bg-gradient-to-br from-amber-400 to-amber-600 text-xl",
                    rank === 2 && "bg-gradient-to-br from-slate-400 to-slate-600 text-lg",
                    rank === 3 && "bg-gradient-to-br from-orange-400 to-amber-700 text-lg"
                  )}
                >
                  #{rank}
                </span>
                <img
                  src={entry.user.profile_avatar || DEFAULT_AVATAR_URL}
                  alt=""
                  className={cx(
                    "rounded-full border-2 border-white/40 object-cover shadow-md",
                    rank === 1 ? "h-20 w-20" : "h-16 w-16"
                  )}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                />
                <div className="w-full">
                  <p className="flex items-center justify-center gap-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                    <span
                      className="max-w-[150px] truncate"
                      title={entry.user.username}
                    >
                      {entry.user.username}
                    </span>
                    {isYou && (
                      <span className="shrink-0 rounded-full bg-[color:var(--accent,#ffd700)]/25 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[color:var(--primary,#1d5330)]">
                        {t("leaderboard.youBadge")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    {t("leaderboard.points", {
                      points: formatNumber(entry.points || 0, locale),
                    })}
                  </p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    );
  };

  const renderListRow = (
    entry: LeaderboardEntry,
    listIndex: number,
    rankOffset: number
  ) => {
    const position = rankForEntry(entry, rankOffset + listIndex + 1);
    const isFriend = isAlreadyFriend(entry.user.id);
    const pending = hasPendingRequest(entry.user.id);
    const isYou = currentUserId !== null && entry.user.id === currentUserId;
    const highlightIdx = position - 1;
    const highlight =
      highlightIdx >= 0 && highlightIdx < listHighlightClasses.length
        ? listHighlightClasses[highlightIdx]
        : "";

    return (
      <GlassCard
        key={entry.user.id}
        padding="md"
        className={cx(
          "group relative flex flex-col gap-4 overflow-hidden border transition hover:-translate-y-1",
          highlight,
          isYou &&
            "ring-2 ring-[color:var(--accent,#ffd700)]/80 ring-offset-2 ring-offset-[color:var(--card-bg,#ffffff)]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--accent,#ffd700)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--input-bg,#f3f4f6)] text-sm font-semibold text-[color:var(--accent,#111827)]"
              aria-label={t("leaderboard.rankShort", { rank: position })}
            >
              #{position}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <img
                src={entry.user.profile_avatar || DEFAULT_AVATAR_URL}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border border-[color:var(--border-color,#d1d5db)] object-cover shadow-sm"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_AVATAR_URL;
                }}
              />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                  <span className="truncate">{entry.user.username}</span>
                  {isYou && (
                    <span className="shrink-0 rounded-full bg-[color:var(--accent,#ffd700)]/25 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[color:var(--primary,#1d5330)]">
                      {t("leaderboard.youBadge")}
                    </span>
                  )}
                </p>
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {t("leaderboard.points", {
                    points: formatNumber(entry.points || 0, locale),
                  })}
                </p>
              </div>
            </div>
            {activeTab === "global" && (
              <button
                type="button"
                title={
                  isFriend
                    ? t("leaderboard.friendStatus.alreadyFriends")
                    : pending
                      ? t("leaderboard.friendStatus.pending")
                      : t("leaderboard.friendStatus.addFriend")
                }
                onClick={() => sendFriendRequest(entry.user.id)}
                disabled={isFriend || pending}
                className={friendActionButtonClass(isFriend, pending)}
              >
                {isFriend
                  ? t("leaderboard.friendStatus.friends")
                  : pending
                    ? t("leaderboard.friendStatus.pendingShort")
                    : t("leaderboard.friendStatus.addFriendShort")}
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    );
  };

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
            {activeTab === "global"
              ? t("leaderboard.title.global")
              : t("leaderboard.title.friends")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("leaderboard.subtitle")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex overflow-hidden rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] p-1 text-sm shadow-sm">
            {["global", "friends"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab as "global" | "friends")}
                className={cx(
                  "relative z-10 inline-flex flex-1 touch-manipulation items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40",
                  activeTab === tab
                    ? "bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/90 text-white shadow-lg shadow-[color:var(--accent,#ffd700)]/30 hover:shadow-xl hover:shadow-[color:var(--accent,#ffd700)]/40"
                    : "border border-white/20 bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--accent,#ffd700)]/60 hover:bg-[color:var(--accent,#ffd700)]/10 hover:text-[color:var(--accent,#ffd700)]"
                )}
              >
                {tab === "global"
                  ? t("leaderboard.tabs.global")
                  : t("leaderboard.tabs.friends")}
              </button>
            ))}
          </div>
          {activeTab === "global" && (
            <div className="relative">
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value)}
                disabled={globalBusy}
                className="w-full rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)] shadow-sm focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 disabled:opacity-60"
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
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xl">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("leaderboard.searchPlaceholder")}
            aria-label={t("leaderboard.searchAriaLabel")}
            className="w-full rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-3 pr-11 text-sm text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
            type="search"
            autoComplete="off"
          />
          <Search
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted-text,#6b7280)]"
            aria-hidden
          />
        </div>
        {error && (
          <div className="rounded-3xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
            {error}
          </div>
        )}
      </div>

      {globalBusy && (
        <p className="text-center text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("leaderboard.loading")}
        </p>
      )}

      {userRank &&
        !filteredLeaderboard.some(
          (entry) => entry.user.id === userRank.user.id
        ) && (
          <GlassCard
            padding="md"
            className="border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--accent,#ffd700)]/10 shadow-[color:var(--accent,#ffd700)]/20"
          >
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent,#ffd700)] text-lg font-bold text-white shadow-md">
                #{userRank.rank ?? "—"}
              </span>
              <div className="flex items-center gap-3">
                <img
                  src={userRank.user.profile_avatar || DEFAULT_AVATAR_URL}
                  alt=""
                  className="h-10 w-10 rounded-full border border-[color:var(--border-color,#d1d5db)] object-cover shadow-sm"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                />
                <div className="text-sm">
                  <p className="font-semibold text-[color:var(--accent,#111827)]">
                    {t("leaderboard.you", {
                      username: userRank.user.username,
                    })}
                  </p>
                  <p className="text-[color:var(--accent,#ffd700)]">
                    {t("leaderboard.points", {
                      points: userRank.points,
                    })}
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
              {t("leaderboard.empty")}
            </p>
          </GlassCard>
        ) : (
          <>
            {renderPodium()}
            {visibleRemainder.map((entry, i) =>
              renderListRow(entry, i, 3)
            )}
            {hasMoreList && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setListVisible((v) => v + LIST_PAGE_SIZE)
                  }
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-2 text-sm font-semibold text-[color:var(--primary,#1d5330)] shadow-sm transition hover:border-[color:var(--accent,#ffd700)]/60 hover:bg-[color:var(--accent,#ffd700)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#ffd700)]/40"
                >
                  {t("leaderboard.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default Leaderboards;
