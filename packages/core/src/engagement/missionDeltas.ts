import type { Mission, MissionBuckets, MissionDelta } from "../types/api";

/**
 * Merge inline mission deltas (returned by action endpoints like lesson
 * complete / savings deposit) into a cached /missions/ payload. Pure function
 * so web and mobile can both feed it to their query-cache updaters.
 *
 * Only fields present on the delta overwrite the cached mission; missions not
 * in the cache are left alone (the next full fetch will pick them up).
 */
export function mergeMissionDeltas(
  cached: MissionBuckets | undefined,
  deltas: MissionDelta[] | undefined,
): MissionBuckets | undefined {
  if (!cached || !deltas || deltas.length === 0) return cached;
  const byId = new Map(deltas.map((d) => [Number(d.id), d]));
  const merge = (list?: Mission[]) =>
    (list ?? []).map((m) => {
      const delta = byId.get(Number(m.id));
      if (!delta) return m;
      return {
        ...m,
        progress: delta.progress ?? m.progress,
        status: (delta.status as Mission["status"]) ?? m.status,
      };
    });
  return {
    ...cached,
    daily_missions: merge(cached.daily_missions),
    weekly_missions: merge(cached.weekly_missions),
  };
}
