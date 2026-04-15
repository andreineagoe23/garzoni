import React, { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../../theme/ThemeContext";
import { radius, shadows, spacing } from "../../theme/tokens";

export type GlassCardPadding = "none" | "sm" | "md" | "lg" | "xl";

type GlassCardProps = {
  children: ReactNode;
  padding?: GlassCardPadding;
  style?: StyleProp<ViewStyle>;
  /** Blur intensity (iOS/Android where supported) */
  intensity?: number;
  /** When the card uses flex:1 (e.g. equal-height dashboard tiles), stretch inner content vertically. */
  fillContent?: boolean;
};

const paddingMap: Record<GlassCardPadding, number> = {
  none: 0,
  sm: spacing.lg,
  md: spacing.xl,
  lg: spacing.xxl,
  xl: spacing.xxxl,
};

/**
 * Frosted glass surface (blur + translucent fill), aligned with web GlassCard.
 */
export default function GlassCard({
  children,
  padding = "md",
  style,
  intensity = 48,
  fillContent = false,
}: GlassCardProps) {
  const { resolved, colors } = useTheme();
  const p = paddingMap[padding];
  const borderColor = colors.glassBorder;
  const tint = resolved === "dark" ? "dark" : "light";
  const overlay =
    resolved === "dark" ? "rgba(30,30,30,0.78)" : "rgba(255,255,255,0.72)";

  return (
    <View
      style={[
        styles.outer,
        {
          borderColor,
          borderRadius: radius.xl,
          overflow: "hidden",
        },
        shadows.md,
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          styles.inner,
          fillContent && styles.innerFill,
          { padding: p, backgroundColor: overlay },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: "relative" },
  inner: { position: "relative", zIndex: 1 },
  innerFill: { flex: 1, minHeight: 0 },
});
