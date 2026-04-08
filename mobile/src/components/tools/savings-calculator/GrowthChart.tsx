import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, {
  Path,
  Polyline,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius, shadows } from "../../../theme/tokens";
import { formatCurrency } from "../../../types/savings-calculator";

type Props = {
  data: { month: number; value: number }[];
  goalAmount: number;
};

const CHART_HEIGHT = 160;
const PAD = { top: 16, right: 16, bottom: 24, left: 52 };

export function GrowthChart({ data, goalAmount }: Props) {
  const c = useThemeColors();
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.xl * 2 - spacing.lg * 2;
  const innerW = chartWidth - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;

  if (data.length < 2) return null;

  const maxY = Math.max(...data.map((d) => d.value), goalAmount) * 1.05;
  const maxX = data[data.length - 1].month;

  const sx = (m: number) => PAD.left + (maxX > 0 ? (m / maxX) * innerW : 0);
  const sy = (v: number) =>
    PAD.top + innerH - (maxY > 0 ? (v / maxY) * innerH : 0);

  // Downsample to 60 points max for performance
  const step = Math.max(1, Math.floor(data.length / 60));
  const sampled = data.filter(
    (_, i) => i % step === 0 || i === data.length - 1,
  );

  const points = sampled.map((d) => `${sx(d.month)},${sy(d.value)}`).join(" ");

  const areaPath = [
    `M ${sx(sampled[0].month)} ${sy(sampled[0].value)}`,
    ...sampled.slice(1).map((d) => `L ${sx(d.month)} ${sy(d.value)}`),
    `L ${sx(sampled[sampled.length - 1].month)} ${sy(0)}`,
    `L ${sx(sampled[0].month)} ${sy(0)}`,
    "Z",
  ].join(" ");

  const goalY = goalAmount > 0 ? sy(goalAmount) : null;

  const yTicks = [0, 0.5, 1].map((t) => ({
    value: t * maxY,
    y: sy(t * maxY),
  }));

  const xTicks = [
    sampled[0],
    sampled[Math.floor(sampled.length / 2)],
    sampled[sampled.length - 1],
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
        Growth Projection
      </Text>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={c.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {yTicks.map((t, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD.left}
              y1={t.y}
              x2={chartWidth - PAD.right}
              y2={t.y}
              stroke={c.border}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <SvgText
              x={PAD.left - 4}
              y={t.y + 4}
              fontSize={9}
              fill={c.textFaint}
              textAnchor="end"
            >
              {t.value >= 1000
                ? `$${(t.value / 1000).toFixed(0)}k`
                : `$${t.value.toFixed(0)}`}
            </SvgText>
          </React.Fragment>
        ))}

        {goalY != null && goalAmount > 0 && (
          <>
            <Line
              x1={PAD.left}
              y1={goalY}
              x2={chartWidth - PAD.right}
              y2={goalY}
              stroke={c.accent}
              strokeWidth={1.5}
              strokeDasharray="6,3"
            />
            <SvgText
              x={chartWidth - PAD.right}
              y={goalY - 4}
              fontSize={9}
              fill={c.accent}
              textAnchor="end"
            >
              Goal
            </SvgText>
          </>
        )}

        <Path d={areaPath} fill="url(#sgGrad)" />
        <Polyline
          points={points}
          fill="none"
          stroke={c.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {xTicks.map((d, i) => (
          <SvgText
            key={i}
            x={sx(d.month)}
            y={CHART_HEIGHT - 4}
            fontSize={9}
            fill={c.textFaint}
            textAnchor="middle"
          >
            {d.month >= 12
              ? `yr ${(d.month / 12).toFixed(0)}`
              : `mo ${d.month}`}
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
