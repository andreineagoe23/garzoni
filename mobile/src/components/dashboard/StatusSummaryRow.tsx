import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import HeartBar from "../ui/HeartBar";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  streak: number;
  points: number;
  hearts: number;
  maxHearts: number;
  coins: number;
};

export default function StatusSummaryRow({
  streak,
  points,
  hearts,
  maxHearts,
  coins,
}: Props) {
  const c = useThemeColors();
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <GlassCard padding="sm" style={styles.chip}>
        <Text style={[styles.val, { color: c.text }]}>{streak} 🔥</Text>
        <Text style={[styles.lbl, { color: c.textMuted }]}>Streak</Text>
      </GlassCard>
      <GlassCard padding="sm" style={styles.chip}>
        <Text style={[styles.val, { color: c.accent }]}>{points}</Text>
        <Text style={[styles.lbl, { color: c.textMuted }]}>XP</Text>
      </GlassCard>
      <GlassCard padding="sm" style={[styles.chip, styles.heartsChip]}>
        <HeartBar hearts={hearts} maxHearts={maxHearts} />
        <Text style={[styles.lbl, { color: c.textMuted, marginTop: 4 }]}>
          Hearts
        </Text>
      </GlassCard>
      <GlassCard padding="sm" style={styles.chip}>
        <Text style={[styles.val, { color: c.text }]}>{coins}</Text>
        <Text style={[styles.lbl, { color: c.textMuted }]}>Coins</Text>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingVertical: 2 },
  chip: { minWidth: 100, marginRight: spacing.sm },
  heartsChip: { minWidth: 140 },
  val: { fontSize: typography.lg, fontWeight: "800" },
  lbl: { fontSize: typography.xs, textTransform: "uppercase", letterSpacing: 0.5 },
});
