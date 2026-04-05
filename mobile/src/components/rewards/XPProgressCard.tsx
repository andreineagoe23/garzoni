import { StyleSheet, Text, View } from "react-native";
import { getUserLevel, type UserLevel } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { ProgressBar } from "../ui";
import { spacing, typography } from "../../theme/tokens";

const THRESHOLDS: Record<UserLevel, { next: number | null; label: string }> = {
  beginner: { next: 750, label: "Beginner" },
  intermediate: { next: 2500, label: "Intermediate" },
  advanced: { next: null, label: "Advanced" },
};

function progressInBand(points: number, level: UserLevel): number {
  if (level === "beginner") {
    return Math.min(1, points / 750);
  }
  if (level === "intermediate") {
    return Math.min(1, (points - 750) / (2500 - 750));
  }
  return 1;
}

type Props = {
  points: number;
};

export default function XPProgressCard({ points }: Props) {
  const c = useThemeColors();
  const level = getUserLevel(points);
  const meta = THRESHOLDS[level];
  const pct = progressInBand(points, level);
  const next = meta.next;

  return (
    <GlassCard padding="md" style={{ borderColor: `${c.accent}55` }}>
      <Text style={[styles.title, { color: c.text }]}>Your XP</Text>
      <Text style={[styles.points, { color: c.accent }]}>
        {points.toLocaleString()} <Text style={{ color: c.textMuted, fontWeight: "600" }}>XP</Text>
      </Text>
      <View style={styles.row}>
        <Text style={[styles.level, { color: c.textMuted }]}>Level: {meta.label}</Text>
        {next != null && points < next ? (
          <Text style={[styles.next, { color: c.textMuted }]}>
            {next - points} XP to next tier
          </Text>
        ) : level === "advanced" ? (
          <Text style={[styles.next, { color: c.textMuted }]}>Max tier</Text>
        ) : null}
      </View>
      <ProgressBar value={pct} height={6} style={{ marginTop: spacing.sm, borderRadius: 999 }} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.sm, fontWeight: "700", marginBottom: 4 },
  points: { fontSize: typography.xxl, fontWeight: "800" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  level: { fontSize: typography.xs, fontWeight: "600" },
  next: { fontSize: typography.xs },
});
