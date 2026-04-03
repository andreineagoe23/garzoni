import { StyleSheet, Text, View } from "react-native";
import type { Mission } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import ProgressBar from "../ui/ProgressBar";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  mission: Mission;
};

export default function MissionCard({ mission }: Props) {
  const c = useThemeColors();
  const title = mission.mission_name || mission.name || "Mission";
  const progress = Math.min(1, Math.max(0, (mission.progress ?? 0) / 100));
  const reward = mission.points_reward ?? 0;
  const status = mission.status ?? "not_started";

  return (
    <GlassCard padding="md" style={{ marginBottom: spacing.md }}>
      <Text style={[styles.title, { color: c.accent }]}>{title}</Text>
      {mission.description ? (
        <Text style={[styles.desc, { color: c.textMuted }]} numberOfLines={4}>
          {mission.description}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: c.textFaint }]}>
          {status.replace("_", " ")}
        </Text>
        {reward > 0 ? (
          <Text style={[styles.meta, { color: c.primary }]}>+{reward} XP</Text>
        ) : null}
      </View>
      <ProgressBar
        value={progress}
        color={c.accent}
        style={{ marginTop: spacing.sm }}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.md, fontWeight: "700" },
  desc: { fontSize: typography.sm, marginTop: spacing.xs, lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  meta: { fontSize: typography.xs, textTransform: "capitalize" },
});
