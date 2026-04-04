import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { radius, spacing, typography } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";

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
  const c = useThemeColors();
  const isDisabled = disabled || loading;

  const theme = useMemo(() => {
    const bg: Record<Variant, string> = {
      primary: c.primary,
      secondary: c.surfaceElevated,
      ghost: "transparent",
      danger: c.error,
    };
    const fg: Record<Variant, string> = {
      primary: c.textOnPrimary,
      secondary: c.text,
      ghost: c.accent,
      danger: c.white,
    };
    const border: Record<Variant, string> = {
      primary: c.primary,
      secondary: c.border,
      ghost: "transparent",
      danger: c.error,
    };
    return { bg, fg, border };
  }, [c]);

  const containerStyle: ViewStyle = {
    backgroundColor: theme.bg[variant],
    borderColor: theme.border[variant],
    height: heights[size],
    opacity: isDisabled ? 0.5 : 1,
  };

  const labelStyle: TextStyle = {
    color: theme.fg[variant],
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
        <ActivityIndicator color={theme.fg[variant]} size="small" />
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
