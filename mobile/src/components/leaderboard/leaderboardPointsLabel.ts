import type { LeaderboardEntry } from "@garzoni/core";

export type LeaderboardTimeFilter = "week" | "month" | "all-time";

/**
 * Windowed XP for week/month, otherwise lifetime points — mirrors the
 * server's `xp_window` semantics (equal to `points` on all-time requests,
 * and absent entirely on the skill-filtered payload).
 */
export function resolveDisplayXp(
  entry: Pick<LeaderboardEntry, "points" | "xp_window">,
  timeFilter: LeaderboardTimeFilter,
): number {
  if (timeFilter === "week" || timeFilter === "month") {
    return entry.xp_window ?? entry.points ?? 0;
  }
  return entry.points ?? 0;
}

/**
 * Localised points label for a leaderboard row/podium card/self-bar.
 * On week/month this reads "1,240 XP this week" (windowed XP); on all-time
 * it keeps the original "1,240 points" copy unchanged.
 */
export function leaderboardPointsLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  formatPoints: (n: number) => string,
  entry: Pick<LeaderboardEntry, "points" | "xp_window">,
  timeFilter: LeaderboardTimeFilter,
): string {
  const xp = resolveDisplayXp(entry, timeFilter);
  if (timeFilter === "week" || timeFilter === "month") {
    return t(`leaderboard.pointsWindow.${timeFilter}`, {
      points: formatPoints(xp),
    });
  }
  return t("leaderboard.points", { points: formatPoints(xp) });
}
