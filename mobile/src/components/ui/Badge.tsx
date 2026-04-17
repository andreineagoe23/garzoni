import React, { useMemo } from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";

type BadgeProps = {
  label: string;
  color?: string;
  bgColor?: string;
  style?: TextStyle;
};

export default function Badge({ label, color, bgColor, style }: BadgeProps) {
  const c = useThemeColors();
  const textColor = color ?? c.primary;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          fontSize: typography.xs,
          fontWeight: "700",
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radius.full,
          overflow: "hidden",
          alignSelf: "flex-start",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
      }),
    [],
  );

  return (
    <Text
      style={[
        styles.badge,
        {
          color: textColor,
          backgroundColor: bgColor ?? `${textColor}18`,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}
