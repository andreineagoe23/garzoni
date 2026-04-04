import {
  fetchFriendsList,
  fetchLeaderboardFriends,
  fetchLeaderboardGlobal,
  fetchLeaderboardRank,
  fetchProfile,
  fetchSentFriendRequests,
  queryKeys,
  sendFriendRequest,
  staleTimes,
  type FriendRequestSent,
  type FriendUserBrief,
  type LeaderboardEntry,
  type UserProfile,
} from "@monevo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import LeaderboardFriendRequestsCard from "../src/components/leaderboard/LeaderboardFriendRequestsCard";
import LeaderboardPodium from "../src/components/leaderboard/LeaderboardPodium";
import LeaderboardReferralCard from "../src/components/leaderboard/LeaderboardReferralCard";
import LeaderboardRow from "../src/components/leaderboard/LeaderboardRow";
import { useThemeColors } from "../src/theme/ThemeContext";
import GlassCard from "../src/components/ui/GlassCard";
import { spacing, typography } from "../src/theme/tokens";

const LIST_PAGE_SIZE = 25;

function referralCodeFromProfile(profile: UserProfile | undefined): string {
  if (!profile) return "";
  const top = typeof profile.referral_code === "string" ? profile.referral_code : "";
  if (top.trim()) return top.trim();
  const ud = profile.user_data as { referral_code?: string } | undefined;
  return typeof ud?.referral_code === "string" ? ud.referral_code.trim() : "";
}

function currentUserIdFromProfile(profile: UserProfile | undefined): number | null {
  if (!profile?.id && profile?.id !== 0) return null;
  const n = Number(profile.id);
  return Number.isFinite(n) ? n : null;
}

export default function LeaderboardScreen() {
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"global" | "friends">("global");
  const [timeFilter, setTimeFilter] = useState("all-time");
  const [searchQuery, setSearchQuery] = useState("");
  const [listVisible, setListVisible] = useState(LIST_PAGE_SIZE);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    staleTime: staleTimes.profile,
  });

  const globalQuery = useQuery({
    queryKey: queryKeys.leaderboardGlobal(timeFilter),
    queryFn: () => fetchLeaderboardGlobal(timeFilter).then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const friendsBoardQuery = useQuery({
    queryKey: queryKeys.leaderboardFriends(),
    queryFn: () => fetchLeaderboardFriends().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const rankQuery = useQuery({
    queryKey: queryKeys.leaderboardRank(),
    queryFn: () => fetchLeaderboardRank().then((r) => r.data),
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

  const profile = profileQuery.data;
  const referralCode = useMemo(() => referralCodeFromProfile(profile), [profile]);
  const currentUserId = useMemo(() => currentUserIdFromProfile(profile), [profile]);

  const sourceList = useMemo(() => {
    if (activeTab === "global") return globalQuery.data ?? [];
    return friendsBoardQuery.data ?? [];
  }, [activeTab, globalQuery.data, friendsBoardQuery.data]);

  const filteredLeaderboard = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((row) =>
      (row.user?.username ?? "").toLowerCase().includes(q)
    );
  }, [sourceList, searchQuery]);

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

  const friends: FriendUserBrief[] = friendsListQuery.data ?? [];
  const sentRequests: FriendRequestSent[] = sentQuery.data ?? [];

  const isAlreadyFriend = useCallback(
    (userId: number) => friends.some((f) => f.id === userId),
    [friends]
  );

  const hasPendingRequest = useCallback(
    (userId: number) =>
      sentRequests.some(
        (r) => r.status === "pending" && r.receiver?.id === userId
      ),
    [sentRequests]
  );

  const formatPoints = useCallback(
    (n: number) => n.toLocaleString(i18n.language),
    [i18n.language]
  );

  const sendMut = useMutation({
    mutationFn: (receiverId: number) => sendFriendRequest(receiverId),
    onSuccess: () => {
      Alert.alert("", t("leaderboard.friendRequestSent"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsSent() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendsList() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.leaderboardGlobal(timeFilter) });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; detail?: string } } };
      Alert.alert(
        "",
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          t("leaderboard.errors.friendRequestFailed")
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
        rankQuery.refetch(),
        sentQuery.refetch(),
        friendsListQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming() }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [
    profileQuery,
    globalQuery,
    friendsBoardQuery,
    rankQuery,
    sentQuery,
    friendsListQuery,
    queryClient,
  ]);

  const userRank = rankQuery.data;
  const showOutOfListRank =
    userRank &&
    !filteredLeaderboard.some((e) => e.user?.id === userRank.user?.id);

  const timeOptions = useMemo(
    () => [
      { value: "all-time", label: t("leaderboard.time.allTime") },
      { value: "month", label: t("leaderboard.time.thisMonth") },
      { value: "week", label: t("leaderboard.time.thisWeek") },
    ],
    [t]
  );

  const pageLoading =
    (activeTab === "global" && globalQuery.isPending && !globalQuery.data) ||
    (activeTab === "friends" && friendsBoardQuery.isPending && !friendsBoardQuery.data);

  const loadError =
    (activeTab === "global" && globalQuery.isError) ||
    (activeTab === "friends" && friendsBoardQuery.isError);

  const rankForEntry = (entry: LeaderboardEntry, fallbackRank: number) =>
    entry.rank ?? fallbackRank;

  const headerTitle =
    activeTab === "global"
      ? t("leaderboard.title.global")
      : t("leaderboard.title.friends");

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <ScrollView
        style={[styles.screen, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        <LeaderboardReferralCard referralCode={referralCode} />
        <LeaderboardFriendRequestsCard />

        <Text style={[styles.h1, { color: c.text }]}>{headerTitle}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {t("leaderboard.subtitle")}
        </Text>

        <View style={[styles.tabBar, { borderColor: c.border, backgroundColor: c.surface }]}>
          {(["global", "friends"] as const).map((tab) => (
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
                  : t("leaderboard.tabs.friends")}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "global" ? (
          <View style={styles.timeRow}>
            {timeOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setTimeFilter(opt.value)}
                style={[
                  styles.timeChip,
                  {
                    borderColor: c.border,
                    backgroundColor:
                      timeFilter === opt.value ? c.accentMuted : c.surface,
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
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("leaderboard.searchPlaceholder")}
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

        {loadError ? (
          <GlassCard padding="md" style={{ borderColor: `${c.error}55`, marginBottom: spacing.md }}>
            <Text style={{ color: c.error, fontSize: typography.sm }}>
              {t("leaderboard.errors.loadFailed")}
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
              marginBottom: spacing.lg,
              borderColor: `${c.accent}66`,
              backgroundColor: `${c.accent}12`,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={[
                  styles.rankCircleLarge,
                  { backgroundColor: c.accent },
                ]}
              >
                <Text style={styles.rankCircleLargeText}>
                  #{userRank.rank ?? "—"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: "700" }}>
                  {t("leaderboard.you", { username: userRank.user.username ?? "" })}
                </Text>
                <Text style={{ color: c.accent, marginTop: 4, fontWeight: "600" }}>
                  {t("leaderboard.points", {
                    points: formatPoints(userRank.points ?? 0),
                  })}
                </Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        {pageLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={{ color: c.textMuted, marginTop: spacing.md }}>
              {t("leaderboard.loading")}
            </Text>
          </View>
        ) : filteredLeaderboard.length === 0 ? (
          <GlassCard padding="lg">
            <Text style={{ color: c.textMuted, textAlign: "center", fontSize: typography.sm }}>
              {t("leaderboard.empty")}
            </Text>
          </GlassCard>
        ) : (
          <>
            <LeaderboardPodium
              entries={podiumEntries}
              currentUserId={currentUserId}
              t={t}
              formatPoints={formatPoints}
            />
            {visibleRemainder.map((entry, i) => {
              const position = rankForEntry(entry, 3 + i + 1);
              const uid = entry.user?.id;
              const isYou = currentUserId !== null && uid === currentUserId;
              const showFriend =
                activeTab === "global" && uid != null && !isYou;
              return (
                <LeaderboardRow
                  key={uid ?? `row-${i}`}
                  entry={entry}
                  position={position}
                  isYou={isYou}
                  showFriendButton={showFriend}
                  isFriend={uid != null ? isAlreadyFriend(uid) : false}
                  pending={uid != null ? hasPendingRequest(uid) : false}
                  busy={sendMut.isPending}
                  onAddFriend={
                    uid != null ? () => sendMut.mutate(uid) : undefined
                  }
                  t={t}
                  formatPoints={formatPoints}
                />
              );
            })}
            {hasMoreList ? (
              <Pressable
                onPress={() => setListVisible((v) => v + LIST_PAGE_SIZE)}
                style={[
                  styles.loadMore,
                  { borderColor: c.border, backgroundColor: c.surface },
                ]}
              >
                <Text style={{ color: c.primary, fontWeight: "700", fontSize: typography.sm }}>
                  {t("leaderboard.loadMore")}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  h1: { fontSize: typography.xl, fontWeight: "800", marginTop: spacing.sm },
  subtitle: { fontSize: typography.sm, marginTop: spacing.xs, lineHeight: 20 },
  tabBar: {
    flexDirection: "row",
    marginTop: spacing.lg,
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
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  search: {
    marginTop: spacing.lg,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.sm,
  },
  busy: { textAlign: "center", marginBottom: spacing.sm, fontSize: typography.sm },
  loader: { paddingVertical: spacing.xxl, alignItems: "center" },
  rankCircleLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCircleLargeText: { color: "#fff", fontWeight: "800", fontSize: typography.md },
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
