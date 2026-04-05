import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";
import { radius, spacing, typography } from "../../theme/tokens";

export type GlassButtonVariant =
  | "primary"
  | "active"
  | "secondary"
  | "success"
  | "danger"
  | "ghost";

export type GlassButtonSize = "sm" | "md" | "lg" | "xl";

type GlassButtonProps = {
  children: string;
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Shared touch heights (aligned with legacy `Button` and web `GlassButton` tiers). */
const heights: Record<GlassButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 52,
  xl: 56,
};

const fontSizes: Record<GlassButtonSize, number> = {
  sm: typography.sm,
  md: typography.base,
  lg: typography.md,
  xl: typography.lg,
};

const horizontalPadding: Record<GlassButtonSize, number> = {
  sm: spacing.lg,
  md: spacing.xl,
  lg: spacing.xl,
  xl: spacing.xxl,
};

/**
 * Single pill-shaped control for the app (dashboard, forms, modals).
 * Use `Button` for semantic primary/secondary/ghost/danger — it delegates here.
 */
export default function GlassButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  onPress,
  style,
}: GlassButtonProps) {
  const c = useThemeColors();
  const isDisabled = disabled || loading;

  const { bg, border, text } = resolveVariant(c, variant);

  const ripple =
    Platform.OS === "android"
      ? {
          color:
            variant === "active" || variant === "success" || variant === "danger"
              ? "rgba(255,255,255,0.25)"
              : `${c.primary}33`,
        }
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:
            pressed && !isDisabled && (variant === "primary" || variant === "secondary")
              ? c.surfaceOffset
              : bg,
          borderColor: border,
          minHeight: heights[size],
          paddingHorizontal: horizontalPadding[size],
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: text, fontSize: fontSizes[size] }]}>
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function resolveVariant(c: ThemeColors, variant: GlassButtonVariant) {
  switch (variant) {
    case "active":
      return {
        bg: c.primary,
        border: c.primary,
        text: c.textOnPrimary,
      };
    case "secondary":
      return {
        bg: c.surfaceElevated,
        border: c.border,
        text: c.text,
      };
    case "success":
      return {
        bg: c.successBg,
        border: c.success,
        text: c.success,
      };
    case "danger":
      return {
        bg: c.error,
        border: c.error,
        text: c.white,
      };
    case "ghost":
      return {
        bg: "transparent",
        border: c.border,
        text: c.accent,
      };
    case "primary":
    default:
      return {
        bg: c.glassFill,
        border: c.border,
        text: c.primary,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  label: { fontWeight: "600" },
});
