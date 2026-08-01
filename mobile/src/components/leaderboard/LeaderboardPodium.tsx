import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { LeaderboardEntry } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { radius, spacing, typography } from "../../theme/tokens";
import { leaderboardAvatarUri } from "./leaderboardAvatarUri";
import {
  leaderboardPointsLabel,
  type LeaderboardTimeFilter,
} from "./leaderboardPointsLabel";

// Gold / Silver / Bronze — medal colours intentionally distinct from brand green
const PODIUM_BORDER = [
  ["#ffd700", "rgba(255,215,0,0.30)"], // 1st — brand gold
  ["#9ca3af", "rgba(156,163,175,0.35)"], // 2nd — silver
  ["#b45309", "rgba(180,83,9,0.35)"], // 3rd — bronze
] as const;

type Props = {
  entries: LeaderboardEntry[];
  currentUserId: number | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  formatPoints: (n: number) => string;
  isFriend?: (userId: number) => boolean;
  isPending?: (userId: number) => boolean;
  onAddFriend?: (userId: number) => void;
  onPressEntry?: (userId: number, isYou: boolean) => void;
  busy?: boolean;
  /** Defaults to "all-time" — pass the active tab's filter to surface windowed XP. */
  timeFilter?: LeaderboardTimeFilter;
};

function rankForEntry(entry: LeaderboardEntry, fallbackRank: number) {
  return entry.rank ?? fallbackRank;
}

export default function LeaderboardPodium({
  entries,
  currentUserId,
  t,
  formatPoints,
  isFriend,
  isPending,
  onAddFriend,
  onPressEntry,
  busy,
  timeFilter = "all-time",
}: Props) {
  const c = useThemeColors();

  const podiumOrder = useMemo((): LeaderboardEntry[] => {
    const [a, b, cc] = entries;
    if (entries.length === 3 && a && b && cc) return [b, a, cc];
    if (entries.length === 2 && a && b) return [b, a];
    return entries;
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <View style={styles.podiumRow}>
      {podiumOrder.map((entry) => {
        const idxInTopThree = entries.indexOf(entry);
        const rank = rankForEntry(entry, idxInTopThree + 1);
        const uid = entry.user?.id;
        const isYou = currentUserId !== null && uid === currentUserId;
        const uri = leaderboardAvatarUri(entry.user?.profile_avatar ?? null);
        const border =
          PODIUM_BORDER[Math.min(idxInTopThree, 2)] ?? PODIUM_BORDER[2];
        return (
          <GlassCard
            key={entry.user?.id ?? `${rank}-${entry.user?.username}`}
            padding="md"
            style={[
              styles.card,
              {
                borderColor: border[1],
                backgroundColor: c.surface,
                marginTop:
                  rank === 2 ? spacing.md : rank === 3 ? spacing.lg : 0,
              },
            ]}
          >
            <Pressable
              onPress={
                uid != null && onPressEntry
                  ? () => onPressEntry(uid, isYou)
                  : undefined
              }
              disabled={!onPressEntry || uid == null}
              style={styles.cardTap}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.avatar} />
              ) : (
                <View
                  style={[styles.avatar, { backgroundColor: c.surfaceOffset }]}
                />
              )}
              <Text
                style={[styles.username, { color: c.text }]}
                numberOfLines={1}
              >
                {entry.user?.username ?? "—"}
              </Text>
              {isYou ? (
                <View
                  style={[styles.youPill, { backgroundColor: `${c.accent}28` }]}
                >
                  <Text style={[styles.youPillText, { color: c.primary }]}>
                    {t("leaderboard.youBadge")}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.points, { color: c.textMuted }]}>
                {leaderboardPointsLabel(t, formatPoints, entry, timeFilter)}
              </Text>
            </Pressable>
            {!isYou && uid != null && onAddFriend
              ? (() => {
                  const already = isFriend?.(uid) ?? false;
                  const pending = isPending?.(uid) ?? false;
                  return (
                    <Pressable
                      onPress={() => onAddFriend(uid)}
                      disabled={already || pending || busy}
                      style={({ pressed }) => [
                        styles.friendBtn,
                        {
                          opacity: pressed ? 0.85 : 1,
                          backgroundColor: already
                            ? `${c.accent}18`
                            : pending
                              ? c.surfaceOffset
                              : c.primary,
                          borderWidth:
                            already || pending ? StyleSheet.hairlineWidth : 0,
                          borderColor: `${c.accent}44`,
                        },
                      ]}
                      accessibilityLabel={
                        already
                          ? t("leaderboard.friendStatus.alreadyFriends")
                          : pending
                            ? t("leaderboard.friendStatus.pending")
                            : t("leaderboard.friendStatus.addFriend")
                      }
                    >
                      <Text
                        style={[
                          styles.friendBtnText,
                          {
                            color: already
                              ? c.accent
                              : pending
                                ? c.textMuted
                                : c.textOnPrimary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {already
                          ? t("leaderboard.friendStatus.friends")
                          : pending
                            ? t("leaderboard.friendStatus.pendingShort")
                            : t("leaderboard.friendStatus.addFriendShort")}
                      </Text>
                    </Pressable>
                  );
                })()
              : null}
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  podiumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    // `stretch`, NOT `flex-end`. The staircase comes from the per-card
    // `marginTop` below; bottom-aligning cancelled it out visually and instead
    // grew the row by the largest margin, leaving a dead 16px band above the
    // podium that read as a gap under the search bar. Stretch keeps the bottoms
    // flush AND makes all three cards the same height regardless of how long
    // the usernames are.
    alignItems: "stretch",
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    borderWidth: 2,
    maxWidth: "34%",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: spacing.xs,
  },
  username: {
    fontSize: typography.xs,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: "100%",
  },
  youPill: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  youPillText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  points: { fontSize: typography.xs, marginTop: spacing.xs, textAlign: "center" },
  friendBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: "stretch",
  },
  friendBtnText: {
    fontSize: typography.xs,
    fontWeight: "700",
    textAlign: "center",
  },
  cardTap: {
    alignItems: "center",
    width: "100%",
  },
});
