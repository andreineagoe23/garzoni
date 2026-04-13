import { useTranslation } from "react-i18next";
import {
  resolveMascotPresentation,
  type MascotSituation,
} from "../engagement/mascotPresentation";
import type { MascotMood, MascotType } from "../engagement/mascotTypes";
import { MOOD_TO_MASCOT } from "../engagement/mascotTypes";

const POOL_KEYS: Record<MascotType, Record<string, string[]>> = {
  owl: {
    celebrate: [
      "mascotPools.owl.celebrate_0",
      "mascotPools.owl.celebrate_1",
      "mascotPools.owl.celebrate_2",
    ],
  },
  bull: {
    encourage: [
      "mascotPools.bull.encourage_0",
      "mascotPools.bull.encourage_1",
      "mascotPools.bull.encourage_2",
    ],
  },
  bear: {
    neutral: [
      "mascotPools.bear.neutral_0",
      "mascotPools.bear.neutral_1",
      "mascotPools.bear.neutral_2",
    ],
  },
};

export type { MascotMood, MascotType } from "../engagement/mascotTypes";
export type { MascotSituation } from "../engagement/mascotPresentation";

export type UseMascotMessageOptions = {
  /** When true, pick from message pool using rotationKey. When false, use first message. */
  rotateMessages?: boolean;
  /** Key for deterministic rotation: index % poolLength. Omit for first message only. */
  rotationKey?: number;
  /** Force a specific mascot (prevents mood-based mascot switching). */
  mascotOverride?: MascotType;
  /**
   * When set, mood/message pools come from {@link resolveMascotPresentation} and the
   * `mood` argument is ignored for resolution (callers may pass `"neutral"` as a placeholder).
   */
  situation?: MascotSituation;
};

/**
 * Returns mascot type and message for a given mood or situation.
 */
export function useMascotMessage(
  mood: MascotMood,
  options: UseMascotMessageOptions = {},
): { mascot: MascotType; message: string } {
  const { t } = useTranslation("common");
  const {
    rotateMessages = false,
    rotationKey = 0,
    mascotOverride,
    situation,
  } = options;

  const resolved = situation ? resolveMascotPresentation(situation) : null;
  const effectiveMood = resolved ? resolved.mood : mood;
  const mascot =
    mascotOverride ?? resolved?.fixedMascot ?? MOOD_TO_MASCOT[effectiveMood];
  const moodKey = effectiveMood as keyof typeof MOOD_TO_MASCOT;

  const situationPool = resolved?.messagePoolKeys;
  const legacyPool = POOL_KEYS[mascot]?.[moodKey];
  const pool =
    situationPool && situationPool.length > 0 ? situationPool : legacyPool;

  let message: string;
  if (pool && pool.length > 0) {
    const index =
      rotateMessages && Number.isFinite(rotationKey)
        ? Math.abs(Math.floor(rotationKey)) % pool.length
        : 0;
    message = t(pool[index]);
  } else {
    message = t(
      `exercises.mascot.${effectiveMood === "celebrate" ? "correct" : effectiveMood === "encourage" ? "encourage" : "neutral"}`,
    );
  }

  return { mascot, message };
}
