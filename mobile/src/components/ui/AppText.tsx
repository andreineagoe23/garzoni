import React from "react";
import { Text, type TextProps, type TextStyle, StyleSheet } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { typography } from "../../theme/tokens";

export type AppTextVariant = "heading" | "body" | "caption" | "label";

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  muted?: boolean;
  accent?: boolean;
  children: React.ReactNode;
};

const variantStyles: Record<
  AppTextVariant,
  Pick<TextStyle, "fontSize" | "fontWeight" | "lineHeight">
> = {
  heading: { fontSize: typography.xl, fontWeight: "700", lineHeight: 28 },
  body: { fontSize: typography.base, fontWeight: "400", lineHeight: 22 },
  caption: { fontSize: typography.sm, fontWeight: "400", lineHeight: 18 },
  label: { fontSize: typography.sm, fontWeight: "600", lineHeight: 18 },
};

/**
 * Theme-aware typography wrapper (matches web heading/body/caption/label).
 */
export default function AppText({
  variant = "body",
  muted = false,
  accent = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  const c = useThemeColors();
  const base = variantStyles[variant];
  const color = accent ? c.accent : muted ? c.textMuted : c.text;

  return (
    <Text
      style={[styles.font, base, { color }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  font: {
    fontFamily: undefined, // system default; load custom via expo-font if needed
  },
});
