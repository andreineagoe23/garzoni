import React, { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { layout } from "../../theme/tokens";
import { useScreenGutter } from "../../utils/platform";

/**
 * Owns a screen's horizontal inset (and the tablet gutter on top of it) so
 * every screen lines up with `TabScreenHeader` and with each other.
 *
 * Screens should not write `paddingHorizontal: spacing.xl + gutter` by hand —
 * that duplication is exactly how the leaderboard ended up 8px narrower than
 * every other tab. See docs/dev/spacing-contract.md.
 */
type ScreenContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Skip the horizontal inset (full-bleed content that insets its own rows). */
  edgeToEdge?: boolean;
};

/** The value a screen should use when it must pass padding to a FlatList etc. */
export function useScreenPaddingX(): number {
  return layout.screenPaddingX + useScreenGutter();
}

export default function ScreenContainer({
  children,
  style,
  edgeToEdge = false,
}: ScreenContainerProps) {
  const paddingHorizontal = useScreenPaddingX();
  return (
    <View style={[edgeToEdge ? null : { paddingHorizontal }, style]}>
      {children}
    </View>
  );
}
