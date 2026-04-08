import React, { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, shadows } from "../../theme/tokens";

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export default function Card({ children, style, padded = true }: CardProps) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
        },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.md,
  },
  padded: { padding: spacing.lg },
});
