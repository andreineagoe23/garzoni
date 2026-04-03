import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";
import { radius, spacing, typography } from "../../theme/tokens";

export type GlassButtonVariant =
  | "primary"
  | "active"
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
  style?: ViewStyle;
};

const heights: Record<GlassButtonSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 54,
};

const fontSizes: Record<GlassButtonSize, number> = {
  sm: typography.xs,
  md: typography.sm,
  lg: typography.base,
  xl: typography.md,
};

/**
 * Rounded pill button matching web GlassButton variants.
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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          minHeight: heights[size],
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
          <Text
            style={[
              styles.label,
              { color: text, fontSize: fontSizes[size] },
            ]}
          >
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
        text: c.white,
      };
    case "success":
      return {
        bg: c.successBg,
        border: c.success,
        text: c.success,
      };
    case "danger":
      return {
        bg: c.errorBg,
        border: c.error,
        text: c.error,
      };
    case "ghost":
      return {
        bg: "transparent",
        border: c.border,
        text: c.textMuted,
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
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontWeight: "600" },
});
