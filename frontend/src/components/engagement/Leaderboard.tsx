import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cx from "classnames";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import PageContainer from "components/common/PageContainer";
import { EmptyState } from "components/dashboard/EmptyState";
import FriendRequests from "components/profile/FriendRequest";
import ReferralLink from "components/profile/ReferralLink";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import apiClient from "services/httpClient";
import { DEFAULT_AVATAR_URL } from "constants/defaultAvatar";
import { formatNumber, getLocale } from "utils/format";
import { safeInternalPath } from "utils/safeInternalPath";
import { useTranslation } from "react-i18next";
import {
  fetchLeagueCurrent,
  type LeagueCurrentResponse,
  type LeagueStandingRow,
  type LeagueTier,
} from "@garzoni/core";

type LeaderboardUser = {
  id: number;
  username: string;
  profile_avatar?: string | null;
};

type LeaderboardEntry = {
  user: LeaderboardUser;
  points: number;
  /**
   * Windowed XP for the requested time_filter (week/month); equals lifetime
   * `points` on all-time requests. Absent on the skill-filtered payload.
   */
  xp_window?: number;
  rank?: number;
};

type TimeFilterValue = "week" | "month" | "all-time";

type FilterChip =
  | { kind: "time"; value: "all-time" | "month" | "week"; label: string }
  | { kind: "skill"; value: string; label: string };

/**
 * Windowed XP for week/month, otherwise lifetime points — matches the
 * server's xp_window semantics (equal to points on all-time).
 */
function resolveDisplayXp(
  entry: Pick<LeaderboardEntry, "points" | "xp_window">,
  timeFilter: TimeFilterValue
): number {
  if (timeFilter === "week" || timeFilter === "month") {
    return entry.xp_window ?? entry.points ?? 0;
  }
  return entry.points ?? 0;
}

/** Maps one league standings row onto the shared LeaderboardEntry shape so
 * the existing podium/list rendering can be reused instead of forked. */
function leagueRowToLeaderboardEntry(row: LeagueStandingRow): LeaderboardEntry {
  return {
    user: { id: row.user_id, username: row.username, profile_avatar: null },
    points: row.weekly_xp,
    xp_window: row.weekly_xp,
    rank: row.rank,
  };
}

type LeaguePromotionZone = "promote" | "hold" | "demote";

// Client-side mirror of the promotion/demotion boundary computed by
// gamification.services.leagues._close_one_league on the backend — display
// only, the backend remains the source of truth at week close. Duplicated
// (rather than shared) from the mobile equivalent in
// mobile/src/components/leaderboard/leaguePromotionZone.ts, same convention
// as resolveDisplayXp above.
const LEAGUE_MIN_COHORT_FOR_PROMOTION = 10;
const LEAGUE_PROMOTE_COUNT = 5;
const LEAGUE_DEMOTE_COUNT = 5;

function leaguePromotionZoneForRank(
  rank: number,
  totalMembers: number
): LeaguePromotionZone {
  if (totalMembers < LEAGUE_MIN_COHORT_FOR_PROMOTION) return "hold";
  const promoteN = Math.min(LEAGUE_PROMOTE_COUNT, totalMembers);
  const demoteN = Math.min(LEAGUE_DEMOTE_COUNT, totalMembers - promoteN);
  if (rank <= promoteN) return "promote";
  if (rank > totalMembers - demoteN) return "demote";
  return "hold";
}

function isCohortEligibleForPromotion(totalMembers: number): boolean {
  return totalMembers >= LEAGUE_MIN_COHORT_FOR_PROMOTION;
}

const LEAGUE_TIER_COLORS: Record<LeagueTier, string> = {
  bronze: "#cd7f32",
  silver: "#a3acb8",
  gold: "#e6c87a",
  diamond: "#63b3ed",
};

function leagueTierColor(tier: string): string {
  return LEAGUE_TIER_COLORS[tier as LeagueTier] ?? LEAGUE_TIER_COLORS.bronze;
}

function leagueTierNameKey(tier: string): string {
  const known = tier in LEAGUE_TIER_COLORS ? tier : "bronze";
  return `leaderboard.leagues.tierName.${known}`;
}

type Friend = {
  id: number;
};

type SentRequest = {
  receiver: { id: number };
};

const LIST_PAGE_SIZE = 25;
/** API filter values — sent verbatim as the `skill` query param, never localised.
 *  Display copy lives under `leaderboard.skills.<value>`. */
const SKILL_TABS = ["Budgeting", "Saving", "Investing", "Markets"] as const;

const podiumHighlight = [
  "border-[#e6c87a]/50 bg-gradient-to-b from-[#e6c87a]/15 via-[#e6c87a]/5 to-transparent shadow-lg shadow-[#e6c87a]/10",
  "app-card shadow-md",
  "app-card shadow-md",
];

const listHighlightClasses = [
  "bg-gradient-to-r from-[#e6c87a]/8 via-[#e6c87a]/3 to-transparent border-[#e6c87a]/30",
  "app-card",
  "app-card",
];

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"] as const;

function friendActionButtonClass(isFriend: boolean, pending: boolean) {
  return cx(
    "ml-auto inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2a7347]/40",
    isFriend &&
      "cursor-not-allowed bg-[#1d5330]/10 text-[color:var(--color-brand-primary-hover)]",
    pending &&
      !isFriend &&
      "cursor-not-allowed bg-[color:var(--color-border-default)] text-content-muted",
    !isFriend &&
      !pending &&
      "bg-[color:var(--color-brand-primary)] text-white shadow hover:shadow-lg"
  );
}

const Leaderboards = () => {
  const locale = getLocale();
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [activeTab, setActiveTab] = useState<"global" | "friends" | "leagues">(
    "global"
  );
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [listVisible, setListVisible] = useState(LIST_PAGE_SIZE);
  // Never hardcoded — the Leagues tab exists only once this response
  // confirms the backend has leagues enabled. Defaults to null (hidden)
  // until the fetch resolves, and stays hidden on a fetch failure too —
  // we never want to flash a tab that immediately disappears.
  const [leagueCurrent, setLeagueCurrent] =
    useState<LeagueCurrentResponse | null>(null);
  const { loadProfile, user, profile } = useAuth();

  const leaguesEnabled = leagueCurrent?.enabled === true;
  const tabs = useMemo(
    () =>
      leaguesEnabled
        ? (["global", "friends", "leagues"] as const)
        : (["global", "friends"] as const),
    [leaguesEnabled]
  );
  useEffect(() => {
    if (activeTab === "leagues" && !leaguesEnabled) setActiveTab("global");
  }, [activeTab, leaguesEnabled]);

  const leagueStandings: LeagueStandingRow[] = useMemo(
    () =>
      leagueCurrent?.enabled === true && leagueCurrent.assigned
        ? leagueCurrent.standings
        : [],
    [leagueCurrent]
  );
  const leagueTotalMembers = leagueStandings.length;
  const leagueAssigned =
    leagueCurrent?.enabled === true && leagueCurrent.assigned
      ? leagueCurrent
      : null;

  const currentUserId = useMemo(() => {
    const id = profile?.id ?? user?.id;
    if (id === undefined || id === null) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [profile?.id, user?.id]);

  // The backend treats time_filter and skill as mutually exclusive —
  // `?skill=` returns early and ignores time_filter — and the friends board
  // never carries a window at all. Single source of truth for "does the
  // currently-visible data represent a window".
  const effectiveTimeFilter: TimeFilterValue =
    activeTab === "global" && !activeSkill
      ? (timeFilter as TimeFilterValue)
      : "all-time";

  const pointsLabel = useCallback(
    (entry: Pick<LeaderboardEntry, "points" | "xp_window">) => {
      const xp = resolveDisplayXp(entry, effectiveTimeFilter);
      if (effectiveTimeFilter === "week" || effectiveTimeFilter === "month") {
        return t(`leaderboard.pointsWindow.${effectiveTimeFilter}`, {
          points: formatNumber(xp, locale),
        });
      }
      return t("leaderboard.points", { points: formatNumber(xp, locale) });
    },
    [effectiveTimeFilter, locale, t]
  );

  // League rows always read as "this cycle's" XP, regardless of the global
  // tab's time_filter selection (which doesn't apply to leagues at all).
  const leaguePointsLabel = useCallback(
    (entry: Pick<LeaderboardEntry, "points" | "xp_window">) =>
      t("leaderboard.pointsWindow.week", {
        points: formatNumber(entry.xp_window ?? entry.points ?? 0, locale),
      }),
    [locale, t]
  );

  // Single combined row: time-window chips and skill chips are mutually
  // exclusive on the backend, so they live in one row with exactly one
  // active chip, instead of a dropdown + a separate button row that
  // implied you could combine them.
  const filterChips: FilterChip[] = useMemo(
    () => [
      { kind: "time", value: "all-time", label: t("leaderboard.time.allTime") },
      { kind: "time", value: "month", label: t("leaderboard.time.thisMonth") },
      { kind: "time", value: "week", label: t("leaderboard.time.thisWeek") },
      ...SKILL_TABS.map((skill): FilterChip => ({
        kind: "skill",
        value: skill,
        label: t(`leaderboard.skills.${skill}`),
      })),
    ],
    [t]
  );

  const isChipActive = (chip: FilterChip) =>
    chip.kind === "time"
      ? !activeSkill && timeFilter === chip.value
      : activeSkill === chip.value;

  const onChipClick = (chip: FilterChip) => {
    if (chip.kind === "time") {
      setActiveSkill(null);
      setTimeFilter(chip.value);
    } else {
      setActiveSkill(chip.value);
    }
  };

  const fetchGlobalLeaderboard = useCallback(async () => {
    const res = await apiClient.get("/leaderboard/", {
      params: {
        time_filter: timeFilter,
        ...(activeSkill ? { skill: activeSkill } : {}),
      },
    });
    return res.data as LeaderboardEntry[];
  }, [activeSkill, timeFilter]);

  const fetchUserRank = useCallback(async () => {
    const res = await apiClient.get("/leaderboard/rank/", {
      params: { time_filter: effectiveTimeFilter },
    });
    return res.data as LeaderboardEntry;
  }, [effectiveTimeFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStableReady(false);
        setError("");
        const [
          friendsResponse,
          profilePayload,
          sentRes,
          friendsRes,
          incomingRes,
          leagueRes,
        ] = await Promise.all([
          apiClient.get("/leaderboard/friends/"),
          loadProfile(),
          apiClient
            .get("/friend-requests/get_sent_requests/")
            .catch(() => ({ data: [] as SentRequest[] })),
          apiClient
            .get("/friend-requests/get_friends/")
            .catch(() => ({ data: [] as Friend[] })),
          apiClient
            .get("/friend-requests/")
            .catch(() => ({ data: [] as { id: number }[] })),
          fetchLeagueCurrent()
            .then((r) => r.data)
            .catch(() => ({ enabled: false }) as LeagueCurrentResponse),
        ]);
        if (cancelled) return;
        setFriendsLeaderboard(friendsResponse.data);
        setLeagueCurrent(leagueRes);
        const resolvedReferralCode =
          (typeof profilePayload?.referral_code === "string" &&
            profilePayload.referral_code) ||
          (typeof (
            profilePayload?.user_data as { referral_code?: string } | undefined
          )?.referral_code === "string" &&
            (
              profilePayload?.user_data as
                { referral_code?: string } | undefined
            )?.referral_code) ||
          "";
        setReferralCode(resolvedReferralCode);
        setSentRequests(sentRes.data);
        setFriends(friendsRes.data);
        setIncomingRequestCount(
          Array.isArray(incomingRes.data) ? incomingRes.data.length : 0
        );
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
        const [data, rank] = await Promise.all([
          fetchGlobalLeaderboard(),
          fetchUserRank(),
        ]);
        if (!cancelled) {
          setGlobalLeaderboard(data);
          setUserRank(rank);
        }
      } catch (err: unknown) {
        console.error("Error fetching global leaderboard:", err);
        const detail = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail;
        if (!cancelled) setError(detail || t("leaderboard.errors.loadFailed"));
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
  }, [fetchGlobalLeaderboard, fetchUserRank, t]);

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

  const startDuel = async (opponentId: number) => {
    try {
      const response = await apiClient.post("/leaderboard/duel/", {
        opponent_id: opponentId,
      });
      window.location.href = safeInternalPath(
        response.data.action_route,
        "/exercises"
      );
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(detail || t("leaderboard.errors.loadFailed"));
    }
  };

  const filteredLeaderboard = useMemo(() => {
    const source =
      activeTab === "global"
        ? globalLeaderboard
        : activeTab === "leagues"
          ? leagueStandings.map(leagueRowToLeaderboardEntry)
          : friendsLeaderboard;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return source;
    return source.filter((userData) =>
      userData.user.username.toLowerCase().includes(query)
    );
  }, [
    activeTab,
    globalLeaderboard,
    friendsLeaderboard,
    leagueStandings,
    searchQuery,
  ]);

  useEffect(() => {
    setListVisible(LIST_PAGE_SIZE);
  }, [searchQuery, activeTab, timeFilter, activeSkill]);

  // Leagues skips the top-3 podium: the promotion/demotion zone framing
  // needs every row (including the top 5) rendered as an ordinary list row
  // with its zone stripe, not a medal card.
  const podiumEntries = useMemo(
    () =>
      activeTab === "leagues"
        ? []
        : filteredLeaderboard.slice(0, Math.min(3, filteredLeaderboard.length)),
    [filteredLeaderboard, activeTab]
  );

  const listRemainder = useMemo(() => {
    if (activeTab === "leagues") return filteredLeaderboard;
    if (filteredLeaderboard.length <= 3) return [];
    return filteredLeaderboard.slice(3);
  }, [filteredLeaderboard, activeTab]);

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
          "flex flex-nowrap items-end justify-between gap-2 md:flex-wrap md:justify-center md:gap-6",
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
            <div
              key={entry.user.id}
              className={cx(
                "app-card app-card--pad-sm relative min-h-[160px] w-[31%] overflow-hidden border-2 transition hover:-translate-y-0.5 md:min-h-[260px] md:w-[220px]",
                podiumHighlight[idxInTopThree] ?? podiumHighlight[2],
                isYou &&
                  "ring-2 ring-[color:var(--color-brand-primary-hover)] ring-offset-2 ring-offset-transparent",
                rank === 1 && "w-[34%] md:w-[220px]",
                rank === 2 && "-translate-y-1 md:translate-y-0 md:order-1",
                rank === 3 && "translate-y-1 md:translate-y-0 md:order-3",
                rank === 2 && "md:order-1",
                rank === 1 && "md:z-10 md:order-2",
                rank === 3 && "md:order-3"
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-brand-primary)]/5 via-transparent to-transparent" />
              <div className="relative flex flex-col items-center gap-1.5 text-center md:gap-3">
                <span
                  className="text-2xl leading-none md:text-4xl"
                  role="img"
                  aria-label={placeLabel(rank)}
                >
                  {medal}
                </span>
                <span
                  className={cx(
                    "inline-flex min-h-[2rem] min-w-[2rem] items-center justify-center rounded-full font-bold text-white shadow-md md:min-h-[3rem] md:min-w-[3rem]",
                    rank === 1 &&
                      "bg-gradient-to-br from-amber-400 to-amber-600 text-sm md:text-xl",
                    rank === 2 &&
                      "bg-gradient-to-br from-slate-400 to-slate-600 text-xs md:text-lg",
                    rank === 3 &&
                      "bg-gradient-to-br from-orange-400 to-amber-700 text-xs md:text-lg"
                  )}
                >
                  #{rank}
                </span>
                <img
                  src={entry.user.profile_avatar || DEFAULT_AVATAR_URL}
                  alt=""
                  className={cx(
                    "rounded-full border-2 border-white/40 object-cover shadow-md",
                    rank === 1
                      ? "h-10 w-10 md:h-20 md:w-20"
                      : "h-9 w-9 md:h-16 md:w-16"
                  )}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                />
                <div className="w-full">
                  <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-content-primary md:gap-2 md:text-base">
                    <span
                      className="max-w-[68px] truncate md:max-w-[150px]"
                      title={entry.user.username}
                    >
                      {entry.user.username}
                    </span>
                    {isYou && (
                      <span className="shrink-0 rounded-full bg-[#2a7347]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--color-brand-primary-hover)] md:px-2 md:text-xs">
                        {t("leaderboard.youBadge")}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-content-muted md:text-sm">
                    {pointsLabel(entry)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListRow = (
    entry: LeaderboardEntry,
    listIndex: number,
    rankOffset: number,
    zoneInfo?: {
      zone: LeaguePromotionZone;
      dividerFor: "promote" | "demote" | null;
    }
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
    const isLeagueRow = activeTab === "leagues";

    return (
      <React.Fragment key={entry.user.id}>
        {zoneInfo?.dividerFor && (
          <p
            className={cx(
              "px-1 text-xs font-extrabold uppercase tracking-wide",
              zoneInfo.dividerFor === "promote"
                ? "text-[color:var(--color-state-success)]"
                : "text-[color:var(--color-state-error)]"
            )}
          >
            {zoneInfo.dividerFor === "promote"
              ? t("leaderboard.leagues.zone.promoteDivider")
              : t("leaderboard.leagues.zone.demoteDivider")}
          </p>
        )}
        <div
          className={cx(
            "app-card--pad-sm group relative flex flex-col gap-4 overflow-hidden border transition hover:-translate-y-1",
            highlight || "app-card-sm",
            isYou &&
              "ring-2 ring-[color:var(--color-brand-primary-hover)]/80 ring-offset-2 ring-offset-transparent",
            isLeagueRow &&
              zoneInfo?.zone === "promote" &&
              "border-l-4 border-l-[color:var(--color-state-success)]",
            isLeagueRow &&
              zoneInfo?.zone === "demote" &&
              "border-l-4 border-l-[color:var(--color-state-error)]"
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#2a7347]/4 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
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
                  className="h-12 w-12 shrink-0 rounded-full border border-[color:var(--color-border-default)] object-cover shadow-sm"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  }}
                />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                    <span className="truncate">{entry.user.username}</span>
                    {isYou && (
                      <span className="shrink-0 rounded-full bg-[color:#2a7347]/25 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[color:var(--color-brand-primary)]">
                        {t("leaderboard.youBadge")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-content-muted">
                    {isLeagueRow
                      ? leaguePointsLabel(entry)
                      : pointsLabel(entry)}
                  </p>
                </div>
              </div>
              {activeTab === "global" && !isYou && (
                <button
                  type="button"
                  onClick={() => startDuel(entry.user.id)}
                  className="inline-flex items-center justify-center rounded-full border border-[#2a7347]/30 px-4 py-2 text-xs font-semibold text-[#2a7347] transition hover:bg-[#2a7347]/10"
                >
                  Duel
                </button>
              )}
              {activeTab === "global" && !isYou && (
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
        </div>
      </React.Fragment>
    );
  };

  return (
    <PageContainer maxWidth="7xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="app-section-glow space-y-1 pb-2">
          <p className="app-eyebrow">{t("leaderboard.subtitle")}</p>
          <h1 className="app-display text-4xl text-content-primary">
            {activeTab === "global"
              ? t("leaderboard.title.global")
              : activeTab === "leagues"
                ? t("leaderboard.title.leagues")
                : t("leaderboard.title.friends")}
          </h1>
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex overflow-hidden rounded-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] p-1 text-sm shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cx(
                  "relative z-10 inline-flex flex-1 touch-manipulation items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2a7347]/40",
                  activeTab === tab
                    ? "bg-gradient-to-r from-[#2a7347] to-[#1d5330] text-white shadow-lg shadow-[#1d5330]/30 hover:shadow-xl hover:shadow-[#1d5330]/40"
                    : "border border-white/20 bg-transparent text-content-muted hover:border-[#2a7347]/50 hover:bg-[#1d5330]/10 hover:text-[color:var(--color-brand-primary-hover)]"
                )}
              >
                {tab === "global"
                  ? t("leaderboard.tabs.global")
                  : tab === "leagues"
                    ? t("leaderboard.tabs.leagues")
                    : incomingRequestCount > 0
                      ? t("leaderboard.tabs.friendsCount", {
                          count: incomingRequestCount,
                        })
                      : t("leaderboard.tabs.friends")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Friend requests + referral live below the tab bar, Friends-tab only —
          previously they rendered above the title/tab bar on every tab, even
          with zero pending requests, pushing the actual leaderboard below the fold. */}
      {activeTab === "friends" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="app-card app-card--pad">
            <ReferralLink referralCode={referralCode} />
          </div>
          <div className="app-card app-card--pad">
            <FriendRequests
              hideWhenEmpty
              onRequestsChange={setIncomingRequestCount}
            />
          </div>
        </div>
      )}

      {activeTab === "leagues" && leagueAssigned && (
        <div
          className="app-card app-card--pad"
          style={{
            borderColor: `${leagueTierColor(leagueAssigned.tier)}66`,
            backgroundColor: `${leagueTierColor(leagueAssigned.tier)}14`,
          }}
        >
          <p className="text-lg font-bold text-content-primary">
            {t(leagueTierNameKey(leagueAssigned.tier))}
          </p>
          <p className="mt-1 text-xs text-content-muted">
            {t("leaderboard.leagues.cycleLabel", {
              cycle: leagueAssigned.cycle_id,
            })}
          </p>
          <p className="mt-2 text-sm text-content-muted">
            {isCohortEligibleForPromotion(leagueTotalMembers)
              ? t("leaderboard.leagues.zone.explanation")
              : t("leaderboard.leagues.notEnoughPlayers")}
          </p>
        </div>
      )}

      {/* Single combined row: time-window chips and skill chips are mutually
          exclusive on the backend, so only one chip is ever active. */}
      {activeTab === "global" && (
        <div className="flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={`${chip.kind}-${chip.value}`}
              type="button"
              disabled={chip.kind === "time" && globalBusy}
              onClick={() => onChipClick(chip)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60",
                isChipActive(chip)
                  ? "border-[#2a7347] bg-[#2a7347]/10 text-[#2a7347]"
                  : "border-[color:var(--color-border-default)] text-content-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xl">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("leaderboard.searchPlaceholder")}
            aria-label={t("leaderboard.searchAriaLabel")}
            className="w-full rounded-3xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] px-5 py-3 pr-11 text-sm text-content-primary shadow-sm focus:border-[#2a7347]/60 focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/30"
            type="search"
            autoComplete="off"
          />
          <Search
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
            aria-hidden
          />
        </div>
        {error && (
          <div className="rounded-3xl border border-[color:var(--color-state-error)]/40 bg-[color:var(--color-state-error)]/10 px-4 py-3 text-sm text-[color:var(--color-state-error)] shadow-inner shadow-[color:var(--color-state-error)]/20">
            {error}
          </div>
        )}
      </div>

      {globalBusy && (
        <p className="text-center text-sm text-content-muted">
          {t("leaderboard.loading")}
        </p>
      )}

      {activeTab !== "leagues" &&
        userRank &&
        !filteredLeaderboard.some(
          (entry) => entry.user.id === userRank.user.id
        ) && (
          <div className="app-card app-card--pad-sm border-[color:var(--color-brand-primary-hover)]/40">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#2a7347] to-[#1d5330] text-lg font-bold text-white shadow-md shadow-[#1d5330]/30">
                #{userRank.rank ?? "—"}
              </span>
              <div className="flex items-center gap-3">
                <img
                  src={userRank.user.profile_avatar || DEFAULT_AVATAR_URL}
                  alt=""
                  className="h-10 w-10 rounded-full border border-[color:var(--color-border-default)] object-cover shadow-sm"
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
                  <p className="text-[color:#2a7347]">
                    {pointsLabel(userRank)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Podium is its own page section — PageContainer's gap owns the space
          above and below it. Do not add margins here. */}
      {renderPodium()}

      {/* Skipped entirely when the podium already covers the whole list, so an
          empty wrapper never eats a container gap slot. */}
      {(filteredLeaderboard.length === 0 ||
        visibleRemainder.length > 0 ||
        hasMoreList) && (
        <div className="space-y-4">
          {filteredLeaderboard.length === 0 && activeTab === "leagues" ? (
            <EmptyState
              icon="🏆"
              title={t("leaderboard.leagues.empty.title")}
              description={t("leaderboard.leagues.empty.description")}
              actionLabel={t("leaderboard.emptyAction")}
              onAction={() => navigate("/personalized-path")}
            />
          ) : filteredLeaderboard.length === 0 ? (
            <EmptyState
              icon="🏆"
              title={t("leaderboard.empty")}
              description={t("leaderboard.emptyDescription")}
              actionLabel={t("leaderboard.emptyAction")}
              onAction={() => navigate("/personalized-path")}
            />
          ) : (
            <>
              {visibleRemainder.map((entry, i) => {
                if (activeTab !== "leagues") {
                  return renderListRow(entry, i, 3);
                }
                const rank = entry.rank ?? i + 1;
                const zone = leaguePromotionZoneForRank(
                  rank,
                  leagueTotalMembers
                );
                const prevEntry = i > 0 ? visibleRemainder[i - 1] : null;
                const prevZone = prevEntry
                  ? leaguePromotionZoneForRank(
                      prevEntry.rank ?? i,
                      leagueTotalMembers
                    )
                  : null;
                const dividerFor =
                  (zone === "promote" || zone === "demote") && zone !== prevZone
                    ? zone
                    : null;
                return renderListRow(entry, i, 0, { zone, dividerFor });
              })}
              {hasMoreList && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setListVisible((v) => v + LIST_PAGE_SIZE)}
                    className="rounded-full border border-[#2a7347]/40 bg-[#1d5330]/10 px-6 py-2 text-sm font-semibold text-[color:var(--color-brand-primary-hover)] shadow-sm transition hover:bg-[#1d5330]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2a7347]/40"
                  >
                    {t("leaderboard.loadMore")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default Leaderboards;
