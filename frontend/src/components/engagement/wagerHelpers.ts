/**
 * Pure date-math helpers for Streak Wagers (see StreakWagerCard). Mirrors
 * mobile/src/components/engagement/wagerHelpers.ts.
 *
 * Dates from the API (`started_on`/`deadline_on`) are plain "YYYY-MM-DD"
 * calendar dates with no time-of-day or zone, so all arithmetic here works
 * in whole calendar days via Date.UTC — never by subtracting local `Date`
 * instances, which would drift a day around DST transitions.
 */

function parseDateOnly(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map((part) => Number(part));
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

function toUtcDayIndex(iso: string): number {
  const { y, m, d } = parseDateOnly(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Whole calendar days remaining from `todayIso` to `deadlineIso`, clamped to
 * >= 0 (a wager whose deadline has passed but hasn't been resolved yet by
 * the nightly job reads as "0 days left", not negative).
 */
export function daysLeftToDeadline(
  deadlineIso: string,
  todayIso: string
): number {
  return Math.max(0, toUtcDayIndex(deadlineIso) - toUtcDayIndex(todayIso));
}

/**
 * "YYYY-MM-DD" for `targetDays` calendar days after `todayIso` — mirrors the
 * backend's `today + timedelta(days=target_days)` (wagers.open_wager) so the
 * confirm step can show the real deadline date before the wager is opened.
 */
export function previewDeadlineOn(
  targetDays: number,
  todayIso: string
): string {
  const { y, m, d } = parseDateOnly(todayIso);
  const ms = Date.UTC(y, m - 1, d + Math.max(0, Math.floor(targetDays || 0)));
  const dt = new Date(ms);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
