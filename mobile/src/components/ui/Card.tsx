import React, { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, shadows } from "../../theme/tokens";
import { CARD_PADDING, type CardPadding } from "./cardPadding";

/**
 * Solid surface card. Shares its radius and padding scale with `GlassCard`
 * (see docs/dev/spacing-contract.md) — the two differ only in fill treatment.
 *
 * The card owns its own padding; do not re-declare `padding` through `style`,
 * and do not give it vertical margins — the parent `Stack` owns vertical rhythm.
 */
type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: CardPadding;
  /** @deprecated pass `padding="none"` instead */
  padded?: boolean;
};

export default function Card({
  children,
  style,
  padding = "md",
  padded = true,
}: CardProps) {
  const c = useThemeColors();
  const pad = padded === false ? CARD_PADDING.none : CARD_PADDING[padding];
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          padding: pad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.md,
  },
});
