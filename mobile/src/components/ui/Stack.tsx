import React, { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { layout } from "../../theme/tokens";

/**
 * Vertical rhythm primitive.
 *
 * THE STACK OWNS THE SPACE BETWEEN ITS CHILDREN. Children must not set
 * `marginTop`/`marginBottom` — React Native does not collapse margins, so a
 * child margin stacks on top of the gap and that child ends up further from its
 * neighbours than everything else on the screen (this is what made the "Your
 * consistency" card look wrong: 16px gap + 12px margin = 28px vs 16px).
 *
 * See docs/dev/spacing-contract.md.
 */
type StackProps = {
  children: ReactNode;
  /** `stack` (16) between related items, `section` (32) between page sections. */
  gap?: "stack" | "section";
  style?: StyleProp<ViewStyle>;
};

const GAP = {
  stack: layout.stackGap,
  section: layout.sectionGap,
} as const;

export default function Stack({ children, gap = "stack", style }: StackProps) {
  return <View style={[{ gap: GAP[gap] }, style]}>{children}</View>;
}
