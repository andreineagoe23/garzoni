export type UserLevel = "beginner" | "intermediate" | "advanced";

const INTERMEDIATE_FLOOR = 750;
const ADVANCED_FLOOR = 2500;
/** XP required to climb one prestige band once "advanced" is reached. */
const PRESTIGE_BAND = 2500;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** Prestige rank at which the label stops incrementing (Advanced X → 25000 XP). */
const MAX_ROMAN_PRESTIGE = 10;

/**
 * Coarse band used across the app for adaptive copy and mission scaling.
 * Backward-compatible: still returns only beginner/intermediate/advanced.
 * Prestige tiers past 2500 XP all report "advanced" here — use {@link getXpTier}
 * when the exact prestige rank/label is needed (e.g. the XP progress card).
 */
export function getUserLevel(points: number): UserLevel {
  if (points >= ADVANCED_FLOOR) return "advanced";
  if (points >= INTERMEDIATE_FLOOR) return "intermediate";
  return "beginner";
}

export type XpTier = {
  /** Coarse band this tier belongs to (backward-compatible with UserLevel). */
  level: UserLevel;
  /**
   * i18n key suffix under `rewards.xpCard.tiers`, e.g. "beginner",
   * "intermediate", "advanced", "advanced-ii" … "advanced-x", "advanced-x+".
   */
  key: string;
  /** Roman numeral of the prestige rank ("" for pre-advanced and Advanced I). */
  roman: string;
  /** Prestige rank: 0 below advanced, 1 = Advanced (I), 2 = Advanced II, … */
  prestige: number;
  /** XP at the start of this tier's band. */
  floor: number;
  /**
   * XP at the start of the next band. Never null — prestige is open-ended, so
   * the goal gradient never dead-ends (the label caps at "advanced-x+").
   */
  next: number;
};

function advancedTier(prestige: number): XpTier {
  // prestige >= 1. 1 = "advanced" (Advanced I), 2 = "advanced-ii", …
  const floor = ADVANCED_FLOOR + (prestige - 1) * PRESTIGE_BAND;
  let key: string;
  let roman: string;
  if (prestige === 1) {
    key = "advanced";
    roman = ""; // display just "Advanced" (Advanced I is implicit)
  } else if (prestige <= MAX_ROMAN_PRESTIGE) {
    roman = ROMAN[prestige - 1];
    key = `advanced-${roman.toLowerCase()}`;
  } else {
    roman = "X+";
    key = "advanced-x+";
  }
  return { level: "advanced", key, roman, prestige, floor, next: floor + PRESTIGE_BAND };
}

/**
 * Full tier descriptor including open-ended prestige ranks past 2500 XP.
 * Every 2500 XP after "advanced" opens a new prestige band (Advanced II at
 * 5000, Advanced III at 7500, …). The label stops incrementing at Advanced X
 * (25000 XP); everything beyond reads "Advanced X+".
 */
export function getXpTier(points: number): XpTier {
  if (points >= ADVANCED_FLOOR) {
    const prestige = Math.floor((points - ADVANCED_FLOOR) / PRESTIGE_BAND) + 1;
    return advancedTier(prestige);
  }
  if (points >= INTERMEDIATE_FLOOR) {
    return {
      level: "intermediate",
      key: "intermediate",
      roman: "",
      prestige: 0,
      floor: INTERMEDIATE_FLOOR,
      next: ADVANCED_FLOOR,
    };
  }
  return {
    level: "beginner",
    key: "beginner",
    roman: "",
    prestige: 0,
    floor: 0,
    next: INTERMEDIATE_FLOOR,
  };
}

/** The tier a learner climbs into next — used for "{xp} to {tier}" copy. */
export function getNextXpTier(points: number): XpTier {
  return getXpTier(getXpTier(points).next);
}
