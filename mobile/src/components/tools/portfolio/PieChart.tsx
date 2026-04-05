import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, G } from "react-native-svg";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import { PIE_COLORS, formatCurrency } from "../../../types/portfolio";
import type { PortfolioSummary } from "../../../types/portfolio";

type Slice = {
  label: string;
  value: number;
  percentage: number;
  color: string;
};

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

type Props = {
  summary: PortfolioSummary;
  size?: number;
};

export function PortfolioPieChart({ summary, size = 200 }: Props) {
  const c = useThemeColors();
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.52; // donut hole

  const slices = useMemo<Slice[]>(() => {
    const total = summary.total_value || 0;
    if (total === 0) return [];
    return Object.entries(summary.allocation).map(([type, value], i) => ({
      label: type.charAt(0).toUpperCase() + type.slice(1).replace("_", " "),
      value: Number(value),
      percentage: (Number(value) / total) * 100,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [summary]);

  const paths = useMemo(() => {
    let currentAngle = 0;
    return slices.map((slice) => {
      const sweepAngle = (slice.percentage / 100) * 360;
      const path = describeArc(cx, cy, outerR, currentAngle, currentAngle + sweepAngle);
      currentAngle += sweepAngle;
      return { ...slice, path };
    });
  }, [slices, cx, cy, outerR]);

  if (paths.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* Pie */}
      <Svg width={size} height={size}>
        <G>
          {paths.map((slice) => (
            <Path
              key={slice.label}
              d={slice.path}
              fill={slice.color}
              stroke={c.surface}
              strokeWidth={2}
            />
          ))}
          {/* Donut hole */}
          <Circle cx={cx} cy={cy} r={innerR} fill={c.surface} />
          {/* Center text */}
          {/* Rendered via absolute View overlay below */}
        </G>
      </Svg>

      {/* Center overlay: total value */}
      <View style={[styles.centerOverlay, { width: innerR * 2, height: innerR * 2, borderRadius: innerR }]}>
        <Text style={[styles.centerLabel, { color: c.textMuted }]}>Total</Text>
        <Text style={[styles.centerValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(summary.total_value || 0)}
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={[styles.legendLabel, { color: c.textMuted }]}>
              {slice.label}{" "}
              <Text style={[styles.legendPct, { color: c.text }]}>
                {slice.percentage.toFixed(1)}%
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: spacing.md,
  },
  centerOverlay: {
    position: "absolute",
    top: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  centerLabel: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  centerValue: {
    fontSize: typography.sm,
    fontWeight: "700",
    marginTop: 2,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: typography.xs,
  },
  legendPct: {
    fontWeight: "700",
  },
});
