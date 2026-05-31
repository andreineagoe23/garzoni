import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  fetchFriendActivityFeed,
  queryKeys,
  type FeedEvent,
} from "@garzoni/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import GlassCard from "../src/components/ui/GlassCard";
import { ErrorState, Skeleton } from "../src/components/ui";
import { spacing, typography, radius } from "../src/theme/tokens";
import { leaderboardAvatarUri } from "../src/components/leaderboard/leaderboardAvatarUri";

function eventLine(
  event: FeedEvent,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const username = event.user.username;
  switch (event.type) {
    case "mission_completed":
      return t("feed.events.missionCompleted", { username });
    case "badge_earned":
      return t("feed.events.badgeEarned", {
        username,
        badge: event.badge_name ?? "",
      });
    case "duel_won":
      return t("feed.events.duelWon", { username });
    case "streak_milestone":
      return t("feed.events.streakMilestone", {
        username,
        count: event.streak_count ?? 0,
      });
    default:
      return username;
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function FeedScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");

  const feedQuery = useQuery({
    queryKey: queryKeys.friendActivityFeed(),
    queryFn: () => fetchFriendActivityFeed().then((r) => r.data),
    staleTime: 60_000,
  });

  return (
    <>
      <Stack.Screen options={{ title: t("feed.title"), headerShown: true }} />
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {feedQuery.isPending ? (
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={64}
                borderRadius={radius.lg}
              />
            ))}
          </View>
        ) : feedQuery.isError ? (
          <View style={{ padding: spacing.xl }}>
            <ErrorState
              message={t("feed.loadFailed")}
              onRetry={() => void feedQuery.refetch()}
            />
          </View>
        ) : (
          <FlatList
            data={feedQuery.data ?? []}
            keyExtractor={(_, idx) => String(idx)}
            contentContainerStyle={{
              padding: spacing.xl,
              gap: spacing.md,
              paddingBottom: spacing.xxxl,
            }}
            refreshControl={
              <RefreshControl
                refreshing={feedQuery.isFetching}
                onRefresh={() => void feedQuery.refetch()}
                tintColor={c.primary}
              />
            }
            renderItem={({ item }) => {
              const uri = leaderboardAvatarUri(
                item.user.profile_avatar ?? null,
              );
              return (
                <Pressable
                  onPress={() => router.push(`/friend/${item.user.id}`)}
                >
                  <GlassCard
                    padding="md"
                    style={[
                      styles.card,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.avatar} />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: c.surfaceOffset },
                        ]}
                      />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.line, { color: c.text }]}
                        numberOfLines={2}
                      >
                        {eventLine(item, t)}
                      </Text>
                      <Text style={[styles.time, { color: c.textMuted }]}>
                        {timeAgo(item.at)}
                      </Text>
                    </View>
                  </GlassCard>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <GlassCard
                padding="lg"
                style={{
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  borderWidth: StyleSheet.hairlineWidth,
                }}
              >
                <Text
                  style={{
                    color: c.textMuted,
                    textAlign: "center",
                    fontSize: typography.sm,
                  }}
                >
                  {t("feed.empty")}
                </Text>
              </GlassCard>
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  line: { fontSize: typography.sm, fontWeight: "700" },
  time: { fontSize: typography.xs, marginTop: 2 },
});
