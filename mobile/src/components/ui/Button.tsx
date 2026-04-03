import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  children: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

const bgColor: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  ghost: "transparent",
  danger: colors.error,
};
const textColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.text,
  ghost: colors.primary,
  danger: colors.white,
};
const borderColor: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.border,
  ghost: "transparent",
  danger: colors.error,
};
const heights: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
const fontSizes: Record<Size, number> = {
  sm: typography.sm,
  md: typography.base,
  lg: typography.md,
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onPress,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    backgroundColor: bgColor[variant],
    borderColor: borderColor[variant],
    height: heights[size],
    opacity: isDisabled ? 0.5 : 1,
  };

  const labelStyle: TextStyle = {
    color: textColor[variant],
    fontSize: fontSizes[size],
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        containerStyle,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} size="small" />
      ) : (
        <Text style={[styles.label, labelStyle]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.75 },
  label: { fontWeight: "600" },
});
