/**
 * Shared "once per device-local day" gate for the `app_opened` Customer.io event.
 *
 * Every Customer.io inactivity segment is defined as "has NOT performed
 * `app_opened` within N days". Until 2026-08-20 only the React Native SDK ever
 * emitted it, so web-only users could never leave the inactive segments — 109
 * of 139 profiles sat in "Inactive 3+ days" permanently and the day-3 comeback
 * fired for people who were using the product daily on the web.
 *
 * The storage layer differs per platform (AsyncStorage on mobile, localStorage
 * on web), so the gate is expressed as a pure decision plus a small runner that
 * takes the storage functions. The decision itself must not be duplicated: two
 * copies of "what counts as today" is how the two platforms drift apart.
 */

export const APP_OPENED_LAST_YMD_KEY = "@cio/app_opened_last_fired_ymd";

/** Local calendar date as `YYYY-MM-DD`. Device-local on purpose: "today" is the user's today. */
export function todayYmdLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True when `app_opened` has not yet been sent on the current local day. */
export function shouldFireAppOpened(
  lastFiredYmd: string | null | undefined,
  today: string = todayYmdLocal(),
): boolean {
  return (lastFiredYmd || "").trim() !== today;
}

export interface AppOpenedGateAdapter {
  readLastFired: () => Promise<string | null> | string | null;
  writeLastFired: (ymd: string) => Promise<void> | void;
  track: () => Promise<void> | void;
}

/**
 * Fire `app_opened` at most once per local day. Safe to call from cold-start
 * hydration and from every foreground — the stored date deduplicates.
 *
 * Never throws: telemetry must not be able to break a session.
 */
export async function runAppOpenedDailyGate(
  adapter: AppOpenedGateAdapter,
): Promise<boolean> {
  try {
    const today = todayYmdLocal();
    const last = await adapter.readLastFired();
    if (!shouldFireAppOpened(last, today)) return false;
    await adapter.track();
    await adapter.writeLastFired(today);
    return true;
  } catch {
    return false;
  }
}
