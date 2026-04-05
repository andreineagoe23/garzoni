import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../../theme/tokens";
import { formatCurrency, formatPercent } from "../../../types/portfolio";
import type { PortfolioSummary } from "../../../types/portfolio";

type Props = {
  summary: PortfolioSummary;
  totalGainLossPercentage: number;
  holdingsCount: number;
};

export function SummaryHeader({ summary, totalGainLossPercentage, holdingsCount }: Props) {
  const c = useThemeColors();
  const isGain = (summary.total_gain_loss ?? 0) >= 0;
  const gainColor = isGain ? c.success : c.error;

  // Animated bar for gain/loss indicator
  const barAnim = useRef(new Animated.Value(0)).current;
  const clampedPct = Math.min(Math.abs(totalGainLossPercentage), 100);

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: clampedPct / 100,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [clampedPct, barAnim]);

  return (
    <View style={styles.row}>
      {/* Total Value */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, shadows.md]}>
        <Text style={[styles.label, { color: c.textMuted }]}>Portfolio Value</Text>
        <Text style={[styles.bigValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(summary.total_value || 0)}
        </Text>
        <Text style={[styles.sub, { color: c.textFaint }]}>current market value</Text>
      </View>

      {/* Gain / Loss */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, shadows.md]}>
        <Text style={[styles.label, { color: c.textMuted }]}>Total Gain / Loss</Text>
        <Text style={[styles.bigValue, { color: gainColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {isGain ? "+" : "−"}
          {formatCurrency(Math.abs(summary.total_gain_loss || 0))}
        </Text>
        <Text style={[styles.sub, { color: gainColor }]}>
          {formatPercent(totalGainLossPercentage)}
        </Text>
        {/* Animated bar */}
        <View style={[styles.barTrack, { backgroundColor: c.surfaceOffset }]}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: gainColor,
                width: barAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* Holdings count */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, shadows.md]}>
        <Text style={[styles.label, { color: c.textMuted }]}>Holdings</Text>
        <Text style={[styles.bigValue, { color: c.text }]}>{holdingsCount}</Text>
        <Text style={[styles.sub, { color: c.textFaint }]}>
          {holdingsCount === 1 ? "investment" : "investments"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bigValue: {
    fontSize: typography.lg,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  sub: {
    fontSize: typography.xs,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
});
