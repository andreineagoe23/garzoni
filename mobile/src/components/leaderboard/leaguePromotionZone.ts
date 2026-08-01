/**
 * Client-side mirror of the promotion/demotion boundary computed by
 * `gamification.services.leagues._close_one_league` on the backend
 * (backend/gamification/services/leagues.py). This is display-only — the
 * backend is the source of truth for the actual outcome at week close — but
 * mirroring the same rule here lets the standings list show an honest
 * "you'd promote/demote/hold right now" indicator instead of guessing.
 *
 * Rule: below MIN_COHORT_FOR_PROMOTION members, nobody promotes or demotes
 * (small cohorts are held entirely). Otherwise the top PROMOTE_COUNT ranks
 * promote and the bottom DEMOTE_COUNT ranks demote (clamped so promote+demote
 * never exceeds the cohort size), everyone else holds.
 */

export const MIN_COHORT_FOR_PROMOTION = 10;
export const PROMOTE_COUNT = 5;
export const DEMOTE_COUNT = 5;

export type LeaguePromotionZone = "promote" | "hold" | "demote";

/**
 * `rank` is 1-based (as returned by the standings API). `totalMembers` is the
 * full cohort size, not a search-filtered subset.
 */
export function leaguePromotionZoneForRank(
  rank: number,
  totalMembers: number,
): LeaguePromotionZone {
  if (totalMembers < MIN_COHORT_FOR_PROMOTION) return "hold";

  const promoteN = Math.min(PROMOTE_COUNT, totalMembers);
  const demoteN = Math.min(DEMOTE_COUNT, totalMembers - promoteN);

  if (rank <= promoteN) return "promote";
  if (rank > totalMembers - demoteN) return "demote";
  return "hold";
}

/** Whether this cohort is large enough for promotion/demotion to apply at all. */
export function isCohortEligibleForPromotion(totalMembers: number): boolean {
  return totalMembers >= MIN_COHORT_FOR_PROMOTION;
}
