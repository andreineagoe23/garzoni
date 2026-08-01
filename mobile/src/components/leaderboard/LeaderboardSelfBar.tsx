import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LeaderboardEntry } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import {
  leaderboardPointsLabel,
  type LeaderboardTimeFilter,
} from "./leaderboardPointsLabel";

type Props = {
  entry: LeaderboardEntry;
  rank: number;
  formatPoints: (n: number) => string;
  onPress?: () => void;
  label?: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** Defaults to "all-time" — pass the active tab's filter to surface windowed XP. */
  timeFilter?: LeaderboardTimeFilter;
};

/**
 * Pinned summary of the current user while browsing the leaderboard list.
 */
export default function LeaderboardSelfBar({
  entry,
  rank,
  formatPoints,
  onPress,
  label = "You",
  t,
  timeFilter = "all-time",
}: Props) {
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.wrap,
        {
          // Leaderboard is a tab screen now — the tab bar already owns the
          // bottom inset, so adding it here would leave a dead band.
          paddingBottom: spacing.sm,
          backgroundColor: c.bg,
          borderTopColor: c.border,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.inner,
          {
            backgroundColor: c.surface,
            borderColor: `${c.accent}88`,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={[styles.rank, { backgroundColor: c.accent }]}>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {label} · {entry.user?.username ?? "—"}
          </Text>
          <Text style={[styles.pts, { color: c.textMuted }]}>
            {leaderboardPointsLabel(t, formatPoints, entry, timeFilter)}
          </Text>
        </View>
        {onPress ? (
          <Text style={[styles.hint, { color: c.primary }]}>Profile</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rank: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#fff", fontWeight: "800", fontSize: typography.sm },
  name: { fontSize: typography.sm, fontWeight: "700" },
  pts: { fontSize: typography.xs, marginTop: 2 },
  hint: { fontSize: typography.xs, fontWeight: "700" },
});
