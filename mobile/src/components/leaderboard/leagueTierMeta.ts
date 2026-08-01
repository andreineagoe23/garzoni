import type { LeagueTier } from "@garzoni/core";
import { brand } from "../../theme/brand";

/** Ascending order, matches backend `League.TIER_ORDER`. */
export const LEAGUE_TIER_ORDER: readonly LeagueTier[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
];

// Fixed badge colours (not theme-derived) — same spirit as the podium medal
// colours on web/mobile: a tier's colour is part of its identity and stays
// legible on both light and dark surfaces.
const TIER_COLORS: Record<LeagueTier, string> = {
  bronze: "#cd7f32",
  silver: "#a3acb8",
  gold: brand.goldWarm,
  diamond: "#63b3ed",
};

export function leagueTierColor(tier: string): string {
  return TIER_COLORS[tier as LeagueTier] ?? TIER_COLORS.bronze;
}

/** i18n key for the tier's display name — callers pass this to `t()`. */
export function leagueTierNameKey(tier: string): string {
  const known = (LEAGUE_TIER_ORDER as readonly string[]).includes(tier)
    ? tier
    : "bronze";
  return `leaderboard.leagues.tierName.${known}`;
}
