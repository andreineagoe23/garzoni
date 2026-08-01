import type { LeagueCurrentResponse } from "@garzoni/core";

export type LeagueViewState =
  "loading" | "error" | "disabled" | "unassigned" | "active";

/**
 * Collapses the `/leagues/current/` query's loading/error/data states into
 * one of five UI states. The API itself only distinguishes three cases
 * (disabled / not-yet-assigned / active cohort — see LeagueCurrentView in
 * backend/gamification/views.py, which returns 200 for all of them); this
 * adds the two client-only states — in flight, and a network/query failure —
 * that the response body can't express on its own.
 */
export function deriveLeagueViewState(params: {
  isPending: boolean;
  isError: boolean;
  data: LeagueCurrentResponse | undefined;
}): LeagueViewState {
  if (params.isError) return "error";
  if (params.isPending || !params.data) return "loading";
  if (params.data.enabled === false) return "disabled";
  if (params.data.assigned === false) return "unassigned";
  return "active";
}

/**
 * Whether the Leagues tab itself should be shown at all. Derived purely from
 * the API response — never hardcoded — and defaults to hidden (false) while
 * loading/erroring/unconfirmed so we never flash a tab that immediately
 * disappears once the real "disabled" answer arrives.
 */
export function isLeaguesEnabled(
  data: LeagueCurrentResponse | undefined,
): boolean {
  return data?.enabled === true;
}
