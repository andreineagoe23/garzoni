import React from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";

type BadgeProps = {
  label: string;
  color?: string;
  bgColor?: string;
  style?: TextStyle;
};

export default function Badge({
  label,
  color = colors.primary,
  bgColor,
  style,
}: BadgeProps) {
  return (
    <Text
      style={[
        styles.badge,
        {
          color,
          backgroundColor: bgColor ?? `${color}18`,
        },
        style,
      ]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
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
});
