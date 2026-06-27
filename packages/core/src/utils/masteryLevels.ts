import type { TFunction } from "i18next";

export type MasteryLevelBand =
  "not_started" | "attempted" | "familiar" | "proficient" | "mastered";

const BANDS: readonly MasteryLevelBand[] = [
  "not_started",
  "attempted",
  "familiar",
  "proficient",
  "mastered",
];

function normalizeBand(band?: string | null): MasteryLevelBand {
  if (band && (BANDS as readonly string[]).includes(band)) {
    return band as MasteryLevelBand;
  }
  return "not_started";
}

/** Localized mastery tier label from API `level_band` (ignores English `level_label`). */
export function masteryLevelLabel(t: TFunction, band?: string | null): string {
  const b = normalizeBand(band);
  return t(`dashboard.masteryLevels.${b}`);
}
