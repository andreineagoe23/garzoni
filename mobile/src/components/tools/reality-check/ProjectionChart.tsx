import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Polyline,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from "react-native-svg";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../../theme/tokens";
import { formatCurrency } from "../../../types/reality-check";

type DataPoint = { month: number; saved: number };

type Props = {
  data: DataPoint[];
  goalAmount: number;
};

const CHART_HEIGHT = 160;
const PADDING = { top: 16, right: 16, bottom: 24, left: 48 };

export function ProjectionChart({ data, goalAmount }: Props) {
  const c = useThemeColors();
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.xl * 2 - spacing.lg * 2;
  const innerW = chartWidth - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  if (data.length < 2) return null;

  const maxY =
    Math.max(...data.map((d) => d.saved), goalAmount > 0 ? goalAmount : 0) *
    1.05;
  const minY = 0;
  const maxX = data[data.length - 1].month;

  const sx = (m: number) => PADDING.left + (m / maxX) * innerW;
  const sy = (v: number) =>
    PADDING.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const points = data.map((d) => `${sx(d.month)},${sy(d.saved)}`).join(" ");

  // Goal line Y
  const goalY = goalAmount > 0 ? sy(goalAmount) : null;

  // Build path for area fill
  const areaPath = [
    `M ${sx(data[0].month)} ${sy(data[0].saved)}`,
    ...data.slice(1).map((d) => `L ${sx(d.month)} ${sy(d.saved)}`),
    `L ${sx(data[data.length - 1].month)} ${sy(0)}`,
    `L ${sx(data[0].month)} ${sy(0)}`,
    "Z",
  ].join(" ");

  // Y-axis labels
  const yTicks = [0, 0.5, 1].map((t) => ({
    value: minY + t * (maxY - minY),
    y: sy(minY + t * (maxY - minY)),
  }));

  // X-axis labels: first, middle, last
  const xTicks = [
    data[0],
    data[Math.floor(data.length / 2)],
    data[data.length - 1],
  ];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        shadows.sm,
      ]}
    >
      <Text style={[styles.title, { color: c.textMuted }]}>
        Savings Projection
      </Text>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primary} stopOpacity="0.25" />
            <Stop offset="1" stopColor={c.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <Line
            key={i}
            x1={PADDING.left}
            y1={t.y}
            x2={chartWidth - PADDING.right}
            y2={t.y}
            stroke={c.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <SvgText
            key={i}
            x={PADDING.left - 4}
            y={t.y + 4}
            fontSize={9}
            fill={c.textFaint}
            textAnchor="end"
          >
            {t.value >= 1000
              ? `$${(t.value / 1000).toFixed(0)}k`
              : `$${t.value.toFixed(0)}`}
          </SvgText>
        ))}

        {/* Goal line */}
        {goalY != null && (
          <>
            <Line
              x1={PADDING.left}
              y1={goalY}
              x2={chartWidth - PADDING.right}
              y2={goalY}
              stroke={c.accent}
              strokeWidth={1.5}
              strokeDasharray="6,3"
            />
            <SvgText
              x={chartWidth - PADDING.right}
              y={goalY - 4}
              fontSize={9}
              fill={c.accent}
              textAnchor="end"
            >
              Goal
            </SvgText>
          </>
        )}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={c.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X axis labels */}
        {xTicks.map((d, i) => (
          <SvgText
            key={i}
            x={sx(d.month)}
            y={CHART_HEIGHT - 4}
            fontSize={9}
            fill={c.textFaint}
            textAnchor="middle"
          >
            {`mo ${d.month}`}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
});
