import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";

type Props = { completed: number; total: number };

export function ProgressBar({ completed, total }: Props) {
  const c = useThemeColors();
  const pct = total > 0 ? Math.min((completed / total) * 100, 100) : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: c.textMuted }]}>
          Today's progress
        </Text>
        <Text style={[styles.count, { color: c.text }]}>
          {completed} / {total}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.surfaceOffset }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: c.primary, width: `${pct}%` as any },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  count: { fontSize: typography.xs, fontWeight: "700" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});
