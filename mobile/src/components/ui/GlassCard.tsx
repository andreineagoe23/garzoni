import React, { type ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadows, spacing } from "../../theme/tokens";

export type GlassCardPadding = "none" | "sm" | "md" | "lg" | "xl";

type GlassCardProps = {
  children: ReactNode;
  padding?: GlassCardPadding;
  style?: StyleProp<ViewStyle>;
  /** Blur intensity — only applied on iOS where BlurView is reliable */
  intensity?: number;
  fillContent?: boolean;
  /** Override the solid fill colour (rarely needed) */
  fillOverlay?: string;
};

const paddingMap: Record<GlassCardPadding, number> = {
  none: 0,
  sm: spacing.lg,
  md: spacing.xl,
  lg: spacing.xxl,
  xl: spacing.xxxl,
};

/**
 * Surface card — uses blur on iOS for the glass effect; solid brand surface
 * everywhere else.  This keeps colours consistent across Android / web and
 * eliminates the dark-grey / blue-tinted containers that BlurView produces on
 * non-iOS platforms.
 */
export default function GlassCard({
  children,
  padding = "md",
  style,
  intensity = 48,
  fillContent = false,
  fillOverlay,
}: GlassCardProps) {
  const { resolved, colors } = useTheme();
  const p = paddingMap[padding];

  // Solid fill that matches the brand surface palette
  const solidFill =
    fillOverlay ?? (resolved === "dark" ? colors.surface : colors.surface);

  const borderColor = colors.border;
  const borderRadius = radius.xl;

  // iOS — keep the frosted glass look with a lighter overlay so the blur shows through
  if (Platform.OS === "ios") {
    const iosFill =
      fillOverlay ??
      (resolved === "dark"
        ? "rgba(17, 24, 39, 0.88)" // brand surface #111827 at 88%
        : "rgba(255, 255, 255, 0.82)");
    return (
      <View
        style={[
          styles.outer,
          { borderColor, borderRadius, overflow: "hidden" },
          shadows.md,
          style,
        ]}
      >
        <BlurView
          intensity={intensity}
          tint={resolved === "dark" ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View
          style={[
            styles.inner,
            fillContent && styles.innerFill,
            { padding: p, backgroundColor: iosFill },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  // Android / web — solid surface, no blur
  return (
    <View
      style={[
        styles.outer,
        {
          borderColor,
          borderRadius,
          backgroundColor: solidFill,
        },
        shadows.md,
        style,
      ]}
    >
      <View
        style={[styles.inner, fillContent && styles.innerFill, { padding: p }]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "relative",
    borderWidth: StyleSheet.hairlineWidth,
  },
  inner: { position: "relative", zIndex: 1 },
  innerFill: { flex: 1, minHeight: 0 },
});
