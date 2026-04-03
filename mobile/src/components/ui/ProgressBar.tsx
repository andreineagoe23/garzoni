import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius } from "../../theme/tokens";

type ProgressBarProps = {
  /** 0–1 */
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
};

export default function ProgressBar({
  value,
  color = colors.primary,
  trackColor = colors.surfaceOffset,
  height = 8,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height }, style]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${clamped * 100}%`,
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.full, overflow: "hidden" },
  fill: { borderRadius: radius.full },
});
