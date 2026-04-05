import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, radius } from "../../../theme/tokens";

function Shimmer({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]} />;
}

export function PortfolioSkeleton() {
  const c = useThemeColors();
  const bg = c.surfaceOffset;

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={[styles.summaryRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.summaryCell}>
            <Shimmer style={[styles.shimmerLabel, { backgroundColor: bg }]} />
            <Shimmer style={[styles.shimmerValue, { backgroundColor: bg }]} />
          </View>
        ))}
      </View>

      {/* Pie circle placeholder */}
      <View style={[styles.pieCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Shimmer style={[styles.pieCircle, { backgroundColor: bg }]} />
        <View style={styles.pieLegend}>
          {[80, 60, 50].map((w, i) => (
            <Shimmer key={i} style={[styles.legendBar, { backgroundColor: bg, width: w }]} />
          ))}
        </View>
      </View>

      {/* 3 holding card placeholders */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.holdingCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.holdingLeft}>
            <Shimmer style={[styles.shimmerBadge, { backgroundColor: bg }]} />
            <Shimmer style={[styles.shimmerSymbol, { backgroundColor: bg }]} />
          </View>
          <View style={styles.holdingRight}>
            <Shimmer style={[styles.shimmerValue, { backgroundColor: bg }]} />
            <Shimmer style={[styles.shimmerLabel, { backgroundColor: bg }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, padding: spacing.lg },

  summaryRow: {
    flexDirection: "row",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryCell: { flex: 1, gap: spacing.xs },
  shimmerLabel: { height: 10, borderRadius: 5, width: "60%" },
  shimmerValue: { height: 24, borderRadius: 6, width: "80%" },

  pieCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.lg,
  },
  pieCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  pieLegend: { gap: spacing.sm, width: "100%", alignItems: "center" },
  legendBar: { height: 10, borderRadius: 5 },

  holdingCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  holdingLeft: { gap: spacing.xs },
  holdingRight: { alignItems: "flex-end", gap: spacing.xs },
  shimmerBadge: { height: 18, width: 48, borderRadius: 9 },
  shimmerSymbol: { height: 20, width: 64, borderRadius: 6 },
});
