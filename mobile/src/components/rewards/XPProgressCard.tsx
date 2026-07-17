import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getXpTier, getNextXpTier } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { ProgressBar } from "../ui";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  points: number;
};

export default function XPProgressCard({ points }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  // Open-ended prestige: past 2500 XP the goal gradient keeps going (Advanced
  // II, III …), so there is always a next tier to climb toward — no dead-end.
  const tier = getXpTier(points);
  const nextTier = getNextXpTier(points);
  const tierLabel = t(`rewards.xpCard.tiers.${tier.key}`);
  const nextLabel = t(`rewards.xpCard.tiers.${nextTier.key}`);
  const band = Math.max(1, tier.next - tier.floor);
  const pct = Math.min(1, Math.max(0, (points - tier.floor) / band));
  const remaining = Math.max(0, tier.next - points);

  return (
    <GlassCard padding="md" style={{ borderColor: `${c.accent}55` }}>
      <Text style={[styles.title, { color: c.text }]}>
        {t("rewards.xpCard.title")}
      </Text>
      <Text style={[styles.points, { color: c.accent }]}>
        {points.toLocaleString()}{" "}
        <Text style={{ color: c.textMuted, fontWeight: "600" }}>XP</Text>
      </Text>
      <View style={styles.row}>
        <Text style={[styles.level, { color: c.textMuted }]}>
          {t("rewards.xpCard.level", { label: tierLabel })}
        </Text>
        <Text style={[styles.next, { color: c.textMuted }]}>
          {t("rewards.xpCard.xpToTier", {
            count: remaining,
            tier: nextLabel,
          })}
        </Text>
      </View>
      <ProgressBar
        value={pct}
        height={6}
        style={{ marginTop: spacing.sm, borderRadius: 999 }}
      />
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
