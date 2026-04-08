import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import CircularProgressRing from "../ui/CircularProgressRing";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  progressPct: number;
  currentXp: number;
  targetXp: number;
};

export default function DailyGoalCard({
  progressPct,
  currentXp,
  targetXp,
}: Props) {
  const c = useThemeColors();
  const frac = Math.min(1, Math.max(0, progressPct / 100));
  return (
    <GlassCard padding="md">
      <Text style={[styles.title, { color: c.accent }]}>Daily goal</Text>
      <Text style={[styles.meta, { color: c.textMuted }]}>
        {currentXp} / {targetXp} XP toward today&apos;s ring
      </Text>
      <View style={styles.row}>
        <CircularProgressRing
          value={frac}
          label={`${Math.round(progressPct)}%`}
        />
        <View style={styles.copy}>
          <Text style={[styles.body, { color: c.text }]}>
            Complete lessons and exercises to fill your daily XP ring.
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.md, fontWeight: "800" },
  meta: { fontSize: typography.sm, marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  copy: { flex: 1 },
  body: { fontSize: typography.sm, lineHeight: 20 },
});
