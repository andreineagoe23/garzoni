import { useTranslation } from "react-i18next";

export type MascotMood = "celebrate" | "encourage" | "neutral";
export type MascotType = "owl" | "bull" | "bear";

const MOOD_TO_MASCOT: Record<MascotMood, MascotType> = {
  celebrate: "owl",
  encourage: "bull",
  neutral: "bear",
};

const POOL_KEYS: Record<MascotType, Record<string, string[]>> = {
  owl: {
    celebrate: ["mascotPools.owl.celebrate_0", "mascotPools.owl.celebrate_1", "mascotPools.owl.celebrate_2"],
  },
  bull: {
    encourage: ["mascotPools.bull.encourage_0", "mascotPools.bull.encourage_1", "mascotPools.bull.encourage_2"],
  },
  bear: {
    neutral: ["mascotPools.bear.neutral_0", "mascotPools.bear.neutral_1", "mascotPools.bear.neutral_2"],
  },
};

export type UseMascotMessageOptions = {
  /** When true, pick from message pool using rotationKey. When false, use first message. */
  rotateMessages?: boolean;
  /** Key for deterministic rotation: index % poolLength. Omit for first message only. */
  rotationKey?: number;
  /** Force a specific mascot (prevents mood-based mascot switching). */
  mascotOverride?: MascotType;
};

/**
 * Returns mascot type and message for a given mood.
 * Supports message pools for variety when rotateMessages is true.
 */
export function useMascotMessage(
  mood: MascotMood,
  options: UseMascotMessageOptions = {}
): { mascot: MascotType; message: string } {
  const { t } = useTranslation("common");
  const { rotateMessages = false, rotationKey = 0, mascotOverride } = options;

  const mascot = mascotOverride ?? MOOD_TO_MASCOT[mood];
  const moodKey = mood as keyof typeof MOOD_TO_MASCOT;
  const pool = POOL_KEYS[mascot]?.[moodKey];

  let message: string;
  if (pool && pool.length > 0) {
    const index = rotateMessages && Number.isFinite(rotationKey)
      ? Math.abs(Math.floor(rotationKey)) % pool.length
      : 0;
    message = t(pool[index]);
  } else {
    message = t(`exercises.mascot.${mood === "celebrate" ? "correct" : mood === "encourage" ? "encourage" : "neutral"}`);
  }

  return { mascot, message };
}
