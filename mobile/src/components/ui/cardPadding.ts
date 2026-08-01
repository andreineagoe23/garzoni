import { spacing } from "../../theme/tokens";

/**
 * The one card padding scale. `Card` and `GlassCard` both read it so the two
 * surfaces can never drift apart (see docs/dev/spacing-contract.md).
 */
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

export const CARD_PADDING: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.lg, // 16
  md: spacing.xl, // 20 — default card density
  lg: spacing.xxl, // 24
  xl: spacing.xxxl, // 32
};
