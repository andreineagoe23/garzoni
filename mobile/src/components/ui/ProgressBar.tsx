import React, { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";

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
  color: colorProp,
  trackColor: trackProp,
  height = 8,
  style,
}: ProgressBarProps) {
  const c = useThemeColors();
  const color = colorProp ?? c.primary;
  const trackColor = trackProp ?? c.surfaceOffset;
  const clamped = Math.max(0, Math.min(1, value));

  const trackStyle = useMemo(
    () => [styles.track, { backgroundColor: trackColor, height }, style],
    [trackColor, height, style]
  );

  return (
    <View style={trackStyle}>
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
