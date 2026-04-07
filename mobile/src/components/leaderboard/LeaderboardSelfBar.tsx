import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LeaderboardEntry } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  entry: LeaderboardEntry;
  rank: number;
  formatPoints: (n: number) => string;
  onPress?: () => void;
  label?: string;
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
}: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, spacing.sm),
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
            {formatPoints(entry.points ?? 0)} pts
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 16,
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
