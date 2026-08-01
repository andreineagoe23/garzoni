import {
  fetchActiveDuels,
  fetchFriendsList,
  fetchIncomingFriendRequests,
  fetchLeaderboardFriends,
  fetchLeaderboardGlobal,
  fetchLeaderboardRank,
  fetchLeagueCurrent,
  fetchProfile,
  fetchSentFriendRequests,
  queryKeys,
  sendFriendRequest,
  staleTimes,
  type FriendRequestSent,
  type FriendUserBrief,
  type LeaderboardEntry,
  type LeagueStandingRow,
  type UserProfile,
} from "@garzoni/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import LeaderboardFriendRequestsCard from "../../src/components/leaderboard/LeaderboardFriendRequestsCard";
import LeaderboardPodium from "../../src/components/leaderboard/LeaderboardPodium";
import LeaderboardReferralCard from "../../src/components/leaderboard/LeaderboardReferralCard";
import LeaderboardRow from "../../src/components/leaderboard/LeaderboardRow";
import LeaderboardSelfBar from "../../src/components/leaderboard/LeaderboardSelfBar";
import LeaderboardSearchResults from "../../src/components/leaderboard/LeaderboardSearchResults";
import LeaderboardSuggestionsCard from "../../src/components/leaderboard/LeaderboardSuggestionsCard";
import LeagueZoneRow from "../../src/components/leaderboard/LeagueZoneRow";
import {
  leaderboardPointsLabel,
  type LeaderboardTimeFilter,
} from "../../src/components/leaderboard/leaderboardPointsLabel";
import { shouldShowFriendRequestsCard } from "../../src/components/leaderboard/leaderboardFriendRequestsVisibility";
import {
  isCohortEligibleForPromotion,
  leaguePromotionZoneForRank,
} from "../../src/components/leaderboard/leaguePromotionZone";
import {
  leagueTierColor,
  leagueTierNameKey,
} from "../../src/components/leaderboard/leagueTierMeta";
import {
  deriveLeagueViewState,
  isLeaguesEnabled,
} from "../../src/components/leaderboard/leagueViewState";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { useScreenGutter } from "../../src/utils/platform";
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";
import { HeaderAvatarButton } from "../../src/components/navigation/HeaderAvatarButton";
import { HeaderRightButtons } from "../../src/components/navigation/HeaderRightButtons";
import GlassCard from "../../src/components/ui/GlassCard";
import Skeleton from "../../src/components/ui/Skeleton";
import { spacing, typography, radius } from "../../src/theme/tokens";

const LIST_PAGE_SIZE = 25;
const SKILL_TABS = ["Budgeting", "Saving", "Investing", "Markets"];

type TabKey = "global" | "friends" | "leagues";
const BASE_TAB_KEYS: readonly TabKey[] = ["global", "friends"] as const;

/** Maps one league standings row onto the shared LeaderboardEntry shape so
 * LeaderboardRow/LeaderboardSelfBar/LeaderboardPodium can be reused as-is
 * instead of forked for the leagues tab. */
function leagueRowToLeaderboardEntry(row: LeagueStandingRow): LeaderboardEntry {
  return {
    user: { id: row.user_id, username: row.username, profile_avatar: null },
    points: row.weekly_xp,
    xp_window: row.weekly_xp,
    rank: row.rank,
  };
}

type FilterChip =
  | { kind: "time"; value: "all-time" | "month" | "week"; label: string }
  | { kind: "skill"; value: string; label: string };

function referralCodeFromProfile(profile: UserProfile | undefined): string {
  if (!profile) return "";
  const top =
    typeof profile.referral_code === "string" ? profile.referral_code : "";
  if (top.trim()) return top.trim();
  const ud = profile.user_data as { referral_code?: string } | undefined;
  return typeof ud?.referral_code === "string" ? ud.referral_code.trim() : "";
}

function currentUserIdFromProfile(
  profile: UserProfile | undefined,
): number | null {
  if (!profile?.id && profile?.id !== 0) return null;
  const n = Number(profile.id);
  return Number.isFinite(n) ? n : null;
}

export default function LeaderboardScreen() {
  const c = useThemeColors();
  const gutter = useScreenGutter();
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("global");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [searchQuery, setSearchQuery] = useState("");
  const [listVisible, setListVisible] = useState(LIST_PAGE_SIZE);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  // The backend treats time_filter and skill as mutually exclusive —
  // `?skill=` returns early and ignores time_filter entirely — and the
  // friends board never carries a window at all. This is the single source
  // of truth for "does the currently-visible data represent a window".
  const effectiveTimeFilter: LeaderboardTimeFilter =
    activeTab === "global" && !activeSkill
      ? (timeFilter as LeaderboardTimeFilter)
      : "all-time";

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    staleTime: staleTimes.profile,
  });

  const globalQuery = useQuery({
    queryKey: queryKeys.leaderboardGlobal(timeFilter, activeSkill),
    queryFn: () =>
      fetchLeaderboardGlobal(timeFilter, activeSkill).then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const friendsBoardQuery = useQuery({
    queryKey: queryKeys.leaderboardFriends(),
    queryFn: () => fetchLeaderboardFriends().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  // Always fetched (not gated to the leagues tab) — this response is also
  // what decides whether the Leagues tab is shown at all.
  const leagueCurrentQuery = useQuery({
    queryKey: queryKeys.leagueCurrent(),
    queryFn: () => fetchLeagueCurrent().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const rankQuery = useQuery({
    queryKey: queryKeys.leaderboardRank(effectiveTimeFilter),
    queryFn: () =>
      fetchLeaderboardRank(effectiveTimeFilter).then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const sentQuery = useQuery({
    queryKey: queryKeys.friendRequestsSent(),
    queryFn: () => fetchSentFriendRequests().then((r) => r.data),
    staleTime: 60_000,
  });

  const friendsListQuery = useQuery({
    queryKey: queryKeys.friendsList(),
    queryFn: () => fetchFriendsList().then((r) => r.data),
    staleTime: 60_000,
  });

  // Lightweight query for the tab badge + card-visibility gate. Same query
  // key as the one inside LeaderboardFriendRequestsCard, so react-query
  // dedupes the network request and shares the cache between the two.
  const incomingRequestsQuery = useQuery({
    queryKey: queryKeys.friendRequestsIncoming(),
    queryFn: () => fetchIncomingFriendRequests().then((r) => r.data),
    staleTime: 60_000,
  });
  const incomingCount = incomingRequestsQuery.data?.length ?? 0;

  const activeDuelsQuery = useQuery({
    queryKey: queryKeys.duelsActive(),
    queryFn: () => fetchActiveDuels().then((r) => r.data),
    staleTime: 60_000,
    enabled: activeTab === "friends",
  });

  const profile = profileQuery.data;
  const referralCode = useMemo(
    () => referralCodeFromProfile(profile),
    [profile],
  );
  const currentUserId = useMemo(
    () => currentUserIdFromProfile(profile),
    [profile],
  );

  // Derived purely from the /leagues/current/ response — never hardcoded —
  // so the tab disappears entirely when the backend reports leagues disabled,
  // and the bar otherwise keeps working exactly as it does today.
  const leaguesEnabled = isLeaguesEnabled(leagueCurrentQuery.data);
  const tabKeys = useMemo<readonly TabKey[]>(
    () => (leaguesEnabled ? [...BASE_TAB_KEYS, "leagues"] : BASE_TAB_KEYS),
    [leaguesEnabled],
  );
  useEffect(() => {
    if (activeTab === "leagues" && !leaguesEnabled) setActiveTab("global");
  }, [activeTab, leaguesEnabled]);

  const leagueViewState = deriveLeagueViewState({
    isPending: leagueCurrentQuery.isPending,
    isError: leagueCurrentQuery.isError,
    data: leagueCurrentQuery.data,
  });
  const leagueData = leagueCurrentQuery.data;
  const leagueStandings = useMemo(
    () =>
      leagueData?.enabled === true && leagueData.assigned
        ? leagueData.standings
        : [],
    [leagueData],
  );
  const leagueTotalMembers = leagueStandings.length;

  const sourceList = useMemo(() => {
    if (activeTab === "global") return globalQuery.data ?? [];
    if (activeTab === "leagues")
      return leagueStandings.map(leagueRowToLeaderboardEntry);
    return friendsBoardQuery.data ?? [];
  }, [activeTab, globalQuery.data, friendsBoardQuery.data, leagueStandings]);

  const filteredLeaderboard = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((row) =>
      (row.user?.username ?? "").toLowerCase().includes(q),
    );
  }, [sourceList, searchQuery]);

  useEffect(() => {
    setListVisible(LIST_PAGE_SIZE);
  }, [searchQuery, activeTab, timeFilter, activeSkill]);

  // Leagues, like friends, skips the top-3 podium: the promotion/demotion
  // zone framing needs the top of the list rendered as ordinary rows (with
  // their zone stripe), not medal cards.
  const podiumEntries = useMemo(
    () =>
      activeTab === "friends" || activeTab === "leagues"
        ? []
        : filteredLeaderboard.slice(0, Math.min(3, filteredLeaderboard.length)),
    [filteredLeaderboard, activeTab],
  );

  const listRemainder = useMemo(() => {
    if (activeTab === "friends" || activeTab === "leagues")
      return filteredLeaderboard;
    if (filteredLeaderboard.length <= 3) return [];
    return filteredLeaderboard.slice(3);
  }, [filteredLeaderboard, activeTab]);

  const visibleRemainder = useMemo(
    () => listRemainder.slice(0, listVisible),
    [listRemainder, listVisible],
  );

  const hasMoreList = listRemainder.length > listVisible;

  const friends: FriendUserBrief[] = friendsListQuery.data ?? [];
  const sentRequests: FriendRequestSent[] = sentQuery.data ?? [];

  const duelStatusByUserId = useMemo(() => {
    const map = new Map<number, "pending" | "active">();
    if (currentUserId == null) return map;
    for (const d of activeDuelsQuery.data ?? []) {
      const otherId =
        d.challenger.id === currentUserId ? d.opponent.id : d.challenger.id;
      const existing = map.get(otherId);
      // active beats pending if a user has both with the same person (rare)
      if (existing === "active") continue;
      if (d.status === "active" || d.status === "pending") {
        map.set(otherId, d.status);
      }
    }
    return map;
  }, [activeDuelsQuery.data, currentUserId]);

  const isAlreadyFriend = useCallback(
    (userId: number) => friends.some((f) => f.id === userId),
    [friends],
  );

  const hasPendingRequest = useCallback(
    (userId: number) =>
      sentRequests.some(
        (r) => r.status === "pending" && r.receiver?.id === userId,
      ),
    [sentRequests],
  );

  const formatPoints = useCallback(
    (n: number) => n.toLocaleString(i18n.language),
    [i18n.language],
  );

  const sendMut = useMutation({
    mutationFn: (receiverId: number) => sendFriendRequest(receiverId),
    onSuccess: () => {
      Alert.alert("", t("leaderboard.friendRequestSent"));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.friendRequestsSent(),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendsList() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboardGlobal(timeFilter, activeSkill),
      });
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { error?: string; detail?: string } };
      };
      Alert.alert(
        "",
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          t("leaderboard.errors.friendRequestFailed"),
      );
    },
  });

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        profileQuery.refetch(),
        globalQuery.refetch(),
        friendsBoardQuery.refetch(),
        leagueCurrentQuery.refetch(),
        rankQuery.refetch(),
        sentQuery.refetch(),
        friendsListQuery.refetch(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.friendRequestsIncoming(),
        }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [
    profileQuery,
    globalQuery,
    friendsBoardQuery,
    leagueCurrentQuery,
    rankQuery,
    sentQuery,
    friendsListQuery,
    queryClient,
    activeSkill,
  ]);

  const userRank = rankQuery.data;
  // The global-leaderboard rank card doesn't apply to the leagues tab (a
  // league rank is a different metric — this cycle's cohort position, not
  // lifetime/windowed XP rank), so it's suppressed there.
  const showOutOfListRank =
    activeTab !== "leagues" &&
    userRank &&
    !filteredLeaderboard.some((e) => e.user?.id === userRank.user?.id);

  // Single combined row: time-window chips and skill chips are mutually
  // exclusive on the backend, so they live in one horizontally scrolling
  // row with exactly one active chip, instead of two independently-live
  // rows that implied you could combine them.
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
    [t],
  );

  const isChipActive = useCallback(
    (chip: FilterChip) =>
      chip.kind === "time"
        ? !activeSkill && timeFilter === chip.value
        : activeSkill === chip.value,
    [activeSkill, timeFilter],
  );

  const onChipPress = useCallback((chip: FilterChip) => {
    if (chip.kind === "time") {
      setActiveSkill(null);
      setTimeFilter(chip.value);
    } else {
      setActiveSkill(chip.value);
    }
  }, []);

  const pageLoading =
    (activeTab === "global" && globalQuery.isPending && !globalQuery.data) ||
    (activeTab === "friends" &&
      friendsBoardQuery.isPending &&
      !friendsBoardQuery.data) ||
    (activeTab === "leagues" && leagueViewState === "loading");

  const loadError =
    (activeTab === "global" && globalQuery.isError) ||
    (activeTab === "friends" && friendsBoardQuery.isError) ||
    (activeTab === "leagues" && leagueViewState === "error");

  const rankForEntry = (entry: LeaderboardEntry, fallbackRank: number) =>
    entry.rank ?? fallbackRank;

  const pinnedSelf = useMemo(() => {
    if (currentUserId == null || pageLoading || loadError) return null;
    const idx = filteredLeaderboard.findIndex(
      (e) => e.user?.id === currentUserId,
    );
    if (idx >= 0) {
      const entry = filteredLeaderboard[idx]!;
      return { entry, rank: rankForEntry(entry, idx + 1) };
    }
    if (
      userRank &&
      userRank.user?.id === currentUserId &&
      (userRank.rank !== undefined || userRank.points !== undefined)
    ) {
      return { entry: userRank, rank: userRank.rank ?? 0 };
    }
    return null;
  }, [currentUserId, pageLoading, loadError, filteredLeaderboard, userRank]);

  const headerTitle =
    activeTab === "global"
      ? t("leaderboard.title.global")
      : activeTab === "leagues"
        ? t("leaderboard.title.leagues")
        : t("leaderboard.title.friends");

  // Vertical rhythm is owned ENTIRELY by styles.headerStack's `gap`. Blocks in
  // here are conditional per tab, so when each block carried its own
  // marginTop/marginBottom the totals silently differed between tabs (tight on
  // Friends, lg on Leagues, md on Global). Do not reintroduce vertical margins
  // on these children — RN does not collapse margins, so they stack on the gap.
  const listHeader = (
    <View style={styles.headerStack}>
      <View>
        <Text style={[styles.h1, { color: c.text }]}>{headerTitle}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {t("leaderboard.subtitle")}
        </Text>
      </View>

      <View
        style={[
          styles.tabBar,
          { borderColor: c.border, backgroundColor: c.surface },
        ]}
      >
        {tabKeys.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === tab ? c.primary : "transparent",
              },
            ]}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "700",
                fontSize: typography.sm,
                color: activeTab === tab ? c.textOnPrimary : c.textMuted,
              }}
            >
              {tab === "global"
                ? t("leaderboard.tabs.global")
                : tab === "leagues"
                  ? t("leaderboard.tabs.leagues")
                  : incomingCount > 0
                    ? t("leaderboard.tabs.friendsCount", {
                        count: incomingCount,
                      })
                    : t("leaderboard.tabs.friends")}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Friend requests + referral live below the tab bar, Friends-tab only —
          previously they rendered above the title/tab bar on every tab, even
          with zero pending requests, pushing the actual leaderboard below the fold. */}
      {activeTab === "friends" ? (
        <>
          <LeaderboardReferralCard referralCode={referralCode} />
          {shouldShowFriendRequestsCard(incomingCount) ? (
            <LeaderboardFriendRequestsCard />
          ) : null}
        </>
      ) : null}

      {activeTab === "leagues" &&
      leagueViewState === "active" &&
      leagueData?.enabled === true &&
      leagueData.assigned ? (
        <GlassCard
          padding="md"
          style={{
            borderColor: `${leagueTierColor(leagueData.tier)}66`,
            backgroundColor: `${leagueTierColor(leagueData.tier)}14`,
          }}
        >
          <Text
            style={{
              color: c.text,
              fontWeight: "800",
              fontSize: typography.md,
            }}
          >
            {t(leagueTierNameKey(leagueData.tier))}
          </Text>
          <Text
            style={{
              color: c.textMuted,
              marginTop: 2,
              fontSize: typography.xs,
            }}
          >
            {t("leaderboard.leagues.cycleLabel", {
              cycle: leagueData.cycle_id,
            })}
          </Text>
          <Text
            style={{
              color: c.textMuted,
              marginTop: spacing.sm,
              fontSize: typography.sm,
            }}
          >
            {isCohortEligibleForPromotion(leagueTotalMembers)
              ? t("leaderboard.leagues.zone.explanation")
              : t("leaderboard.leagues.notEnoughPlayers")}
          </Text>
        </GlassCard>
      ) : null}

      {activeTab === "global" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeRow}
        >
          {filterChips.map((chip) => {
            const active = isChipActive(chip);
            return (
              <Pressable
                key={`${chip.kind}-${chip.value}`}
                onPress={() => onChipPress(chip)}
                style={[
                  styles.timeChip,
                  {
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.primarySoft : c.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: typography.xs,
                    fontWeight: "700",
                    color: c.text,
                  }}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("userSearch.placeholder")}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={t("leaderboard.searchAriaLabel")}
        style={[
          styles.search,
          {
            borderColor: c.border,
            backgroundColor: c.surface,
            color: c.text,
          },
        ]}
      />

      {searchQuery.trim().length > 0 ? (
        <LeaderboardSearchResults query={searchQuery} />
      ) : null}

      {activeTab === "friends" && searchQuery.trim().length === 0 ? (
        <LeaderboardSuggestionsCard />
      ) : null}

      {loadError ? (
        <GlassCard padding="md" style={{ borderColor: `${c.error}55` }}>
          <Text style={{ color: c.error, fontSize: typography.sm }}>
            {activeTab === "leagues"
              ? t("leaderboard.leagues.loadFailed")
              : t("leaderboard.errors.loadFailed")}
          </Text>
        </GlassCard>
      ) : null}

      {activeTab === "global" && globalQuery.isFetching && globalQuery.data ? (
        <Text style={[styles.busy, { color: c.textMuted }]}>
          {t("leaderboard.loading")}
        </Text>
      ) : null}

      {showOutOfListRank && userRank?.user ? (
        <GlassCard
          padding="md"
          style={{
            borderColor: `${c.accent}66`,
            backgroundColor: `${c.accent}12`,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={[styles.rankCircleLarge, { backgroundColor: c.accent }]}
            >
              <Text style={styles.rankCircleLargeText}>
                #{userRank.rank ?? "—"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: "700" }}>
                {t("leaderboard.you", {
                  username: userRank.user.username ?? "",
                })}
              </Text>
              <Text
                style={{ color: c.accent, marginTop: 4, fontWeight: "600" }}
              >
                {leaderboardPointsLabel(
                  t,
                  formatPoints,
                  userRank,
                  effectiveTimeFilter,
                )}
              </Text>
            </View>
          </View>
        </GlassCard>
      ) : null}

      {!pageLoading && loadError === false && filteredLeaderboard.length > 0 ? (
        <LeaderboardPodium
          entries={podiumEntries}
          currentUserId={currentUserId}
          t={t}
          formatPoints={formatPoints}
          isFriend={isAlreadyFriend}
          isPending={hasPendingRequest}
          onAddFriend={
            activeTab === "global" ? (uid) => sendMut.mutate(uid) : undefined
          }
          onPressEntry={(uid, isYou) =>
            isYou
              ? router.push("/(tabs)/profile")
              : router.push(`/friend/${uid}`)
          }
          busy={sendMut.isPending}
          timeFilter={effectiveTimeFilter}
        />
      ) : null}
    </View>
  );

  const listEmpty = pageLoading ? (
    <View style={styles.loader}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={36} height={36} borderRadius={radius.full} />
          <Skeleton
            width="60%"
            height={16}
            borderRadius={radius.sm}
            style={{ marginLeft: spacing.md, flexShrink: 1 }}
          />
          <Skeleton width={40} height={16} borderRadius={radius.sm} />
        </View>
      ))}
      <Text style={{ color: c.textMuted, marginTop: spacing.md }}>
        {t("leaderboard.loading")}
      </Text>
    </View>
  ) : filteredLeaderboard.length === 0 &&
    !loadError &&
    activeTab === "leagues" &&
    leagueViewState === "unassigned" ? (
    <GlassCard padding="lg">
      <Text
        style={{
          color: c.text,
          textAlign: "center",
          fontWeight: "700",
          fontSize: typography.base,
        }}
      >
        {t("leaderboard.leagues.empty.title")}
      </Text>
      <Text
        style={{
          color: c.textMuted,
          textAlign: "center",
          fontSize: typography.sm,
          marginTop: spacing.xs,
        }}
      >
        {t("leaderboard.leagues.empty.description")}
      </Text>
    </GlassCard>
  ) : filteredLeaderboard.length === 0 && !loadError ? (
    <GlassCard padding="lg">
      <Text
        style={{
          color: c.textMuted,
          textAlign: "center",
          fontSize: typography.sm,
        }}
      >
        {t("leaderboard.empty")}
      </Text>
    </GlassCard>
  ) : null;

  const flatData =
    pageLoading || filteredLeaderboard.length === 0 ? [] : visibleRemainder;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <TabScreenHeader
        title={t("nav.leaderboard", { defaultValue: "Leaderboard" })}
        left={<HeaderAvatarButton />}
        right={<HeaderRightButtons />}
      />
      <View style={{ flex: 1 }}>
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => String(item.user?.id ?? `row-${i}`)}
          renderItem={({ item, index }) => {
            const positionOffset =
              activeTab === "friends" || activeTab === "leagues" ? 0 : 3;
            const position = rankForEntry(item, positionOffset + index + 1);
            const uid = item.user?.id;
            const isYou = currentUserId !== null && uid === currentUserId;
            const showFriend = activeTab === "global" && uid != null && !isYou;
            const duelStatus =
              activeTab === "friends" && uid != null && !isYou
                ? (duelStatusByUserId.get(uid) ?? null)
                : null;
            const row = (
              <LeaderboardRow
                entry={item}
                position={position}
                isYou={isYou}
                showFriendButton={showFriend}
                isFriend={uid != null ? isAlreadyFriend(uid) : false}
                pending={uid != null ? hasPendingRequest(uid) : false}
                busy={sendMut.isPending}
                onAddFriend={
                  uid != null ? () => sendMut.mutate(uid) : undefined
                }
                onPrimaryPress={
                  isYou
                    ? () => router.push("/(tabs)/profile")
                    : uid != null
                      ? () => router.push(`/friend/${uid}`)
                      : undefined
                }
                t={t}
                formatPoints={formatPoints}
                duelStatus={duelStatus}
                timeFilter={
                  activeTab === "leagues" ? "week" : effectiveTimeFilter
                }
              />
            );

            if (activeTab !== "leagues") return row;

            // Zone is derived from the row's actual league rank (not the
            // possibly search-filtered `position`) against the full cohort
            // size, mirroring backend/gamification/services/leagues.py's
            // promotion/demotion boundary.
            const rank = item.rank ?? position;
            const zone = leaguePromotionZoneForRank(rank, leagueTotalMembers);
            const prevItem = index > 0 ? visibleRemainder[index - 1] : null;
            const prevZone = prevItem
              ? leaguePromotionZoneForRank(
                  prevItem.rank ?? position,
                  leagueTotalMembers,
                )
              : null;
            const dividerFor =
              (zone === "promote" || zone === "demote") && zone !== prevZone
                ? zone
                : null;
            return (
              <LeagueZoneRow
                zone={zone}
                dividerFor={dividerFor}
                dividerLabel={
                  dividerFor === "promote"
                    ? t("leaderboard.leagues.zone.promoteDivider")
                    : dividerFor === "demote"
                      ? t("leaderboard.leagues.zone.demoteDivider")
                      : undefined
                }
              >
                {row}
              </LeagueZoneRow>
            );
          }}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={
            hasMoreList ? (
              <Pressable
                onPress={() => setListVisible((v) => v + LIST_PAGE_SIZE)}
                style={[
                  styles.loadMore,
                  { borderColor: c.border, backgroundColor: c.surface },
                ]}
              >
                <Text
                  style={{
                    color: c.primary,
                    fontWeight: "700",
                    fontSize: typography.sm,
                  }}
                >
                  {t("leaderboard.loadMore")}
                </Text>
              </Pressable>
            ) : null
          }
          contentContainerStyle={[
            styles.content,
            {
              flexGrow: 1,
              paddingHorizontal: spacing.md + gutter,
              paddingBottom: pinnedSelf ? 100 : spacing.xxxl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          }
        />
        {pinnedSelf ? (
          <LeaderboardSelfBar
            entry={pinnedSelf.entry}
            rank={pinnedSelf.rank}
            formatPoints={formatPoints}
            t={t}
            timeFilter={activeTab === "leagues" ? "week" : effectiveTimeFilter}
            onPress={() => {
              router.push("/(tabs)/profile");
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 48,
  },
  // Single owner of the header's vertical rhythm — every direct child of the
  // header is spaced by this gap alone. paddingBottom separates the last
  // header block from the first list row regardless of which tab is active.
  headerStack: { gap: spacing.lg, paddingBottom: spacing.lg },
  h1: { fontSize: typography.xl, fontWeight: "800", marginTop: spacing.sm },
  subtitle: { fontSize: typography.sm, marginTop: spacing.xs, lineHeight: 20 },
  tabBar: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    justifyContent: "center",
  },
  timeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  search: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.sm,
  },
  busy: {
    textAlign: "center",
    marginBottom: spacing.sm,
    fontSize: typography.sm,
  },
  loader: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    width: "100%",
    paddingHorizontal: spacing.lg,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  rankCircleLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCircleLargeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: typography.md,
  },
  loadMore: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
