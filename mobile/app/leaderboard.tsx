import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLeaderboardGlobal,
  fetchLeaderboardRank,
  getMediaBaseUrl,
  queryKeys,
  staleTimes,
  type LeaderboardEntry,
} from "@monevo/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

const FILTERS = [
  { id: "all-time", label: "All time" },
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
] as const;

export default function LeaderboardScreen() {
  const c = useThemeColors();
  const [time, setTime] = useState<(typeof FILTERS)[number]["id"]>("all-time");

  const listQuery = useQuery({
    queryKey: queryKeys.leaderboardGlobal(time),
    queryFn: () => fetchLeaderboardGlobal(time).then((r) => r.data),
    staleTime: staleTimes.progressSummary,
  });

  const rankQuery = useQuery({
    queryKey: ["leaderboardRank"],
    queryFn: () => fetchLeaderboardRank().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const onRefresh = useCallback(() => {
    void listQuery.refetch();
    void rankQuery.refetch();
  }, [listQuery, rankQuery]);

  const entries = listQuery.data ?? [];
  const you = rankQuery.data;

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const u = item.user;
    const avatar =
      u?.profile_avatar && !String(u.profile_avatar).startsWith("http")
        ? `${getMediaBaseUrl()}/media/${String(u.profile_avatar).replace(/^\/+/, "")}`
        : u?.profile_avatar || undefined;
    return (
      <View
        style={[
          styles.row,
          { borderColor: c.border, backgroundColor: c.surface },
        ]}
      >
        <Text style={[styles.rank, { color: c.textMuted }]}>{index + 1}</Text>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: c.surfaceOffset }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {u?.username ?? "—"}
          </Text>
        </View>
        <Text style={[styles.pts, { color: c.accent }]}>{item.points ?? 0} XP</Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Leaderboard", headerShown: true, headerTintColor: c.primary }} />
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {you ? (
          <View style={[styles.youBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.textMuted, fontSize: typography.xs }}>Your rank</Text>
            <Text style={{ color: c.text, fontWeight: "800", fontSize: typography.lg }}>
              #{you.rank ?? "—"} · {you.points ?? 0} XP
            </Text>
          </View>
        ) : null}

        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setTime(f.id)}
              style={[
                styles.filterChip,
                {
                  borderColor: c.border,
                  backgroundColor: time === f.id ? c.accentMuted : c.surface,
                },
              ]}
            >
              <Text style={{ color: c.text, fontWeight: "600", fontSize: typography.sm }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={entries}
          keyExtractor={(item, i) => `${item.user?.id ?? i}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={listQuery.isFetching} onRefresh={onRefresh} tintColor={c.primary} />
          }
          ListEmptyComponent={
            listQuery.isPending ? (
              <Text style={{ color: c.textMuted, textAlign: "center", marginTop: spacing.xl }}>
                Loading…
              </Text>
            ) : (
              <Text style={{ color: c.textMuted, textAlign: "center", marginTop: spacing.xl }}>
                No entries yet.
              </Text>
            )
          }
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  youBanner: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filters: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rank: { width: 28, fontWeight: "800", fontSize: typography.sm },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  name: { fontSize: typography.base, fontWeight: "600" },
  pts: { fontSize: typography.sm, fontWeight: "700" },
});
