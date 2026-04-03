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
  /** iOS blur intensity */
  intensity?: number;
};

const paddingMap: Record<GlassCardPadding, number> = {
  none: 0,
  sm: spacing.lg,
  md: spacing.xl,
  lg: spacing.xxl,
  xl: spacing.xxxl,
};

/**
 * Translucent surface with blur on iOS; solid themed fallback on Android.
 */
export default function GlassCard({
  children,
  padding = "md",
  style,
  intensity = 40,
}: GlassCardProps) {
  const { resolved, colors } = useTheme();
  const p = paddingMap[padding];
  const borderColor = colors.glassBorder;
  const bgFallback = colors.glassFill;

  if (Platform.OS === "ios") {
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
          tint={resolved === "dark" ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.inner,
            {
              padding: p,
              backgroundColor:
                resolved === "dark"
                  ? "rgba(30,30,30,0.75)"
                  : "rgba(255,255,255,0.65)",
            },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.outer,
        {
          borderRadius: radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor,
          backgroundColor: bgFallback,
          padding: p,
        },
        shadows.md,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: "relative" },
  inner: { position: "relative", zIndex: 1 },
});
