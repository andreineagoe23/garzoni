import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { spacing, typography, radius } from "../../../theme/tokens";
import { IMPACT_COLORS } from "../../../types/economic-calendar";
import type { ImpactLevel } from "../../../types/economic-calendar";

type Props = { impact: ImpactLevel };

const LABELS: Record<ImpactLevel, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

export function ImpactBadge({ impact }: Props) {
  const color = IMPACT_COLORS[impact];
  const bg = color + "20";

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{LABELS[impact]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
