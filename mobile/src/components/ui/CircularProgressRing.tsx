import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeColors } from "../../theme/ThemeContext";
import { typography } from "../../theme/tokens";

type Props = {
  /** 0–1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  activeColor?: string;
  label?: string;
};

export default function CircularProgressRing({
  value,
  size = 88,
  strokeWidth = 8,
  trackColor,
  activeColor,
  label,
}: Props) {
  const themeColors = useThemeColors();
  const track = trackColor ?? themeColors.surfaceOffset;
  const active = activeColor ?? themeColors.primary;
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);
  const cx = size / 2;
  const cy = size / 2;

  const displayLabel = label ?? `${Math.round(clamped * 100)}%`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={active}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.labelBox}>
          <Text style={[styles.labelText, { color: themeColors.text }]}>
            {displayLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  labelBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    fontSize: typography.md,
    fontWeight: "700",
  },
});
