import { MASTERY_SKILL_TO_EXERCISE_CATEGORY } from "../constants/skillToExerciseCategory";

/**
 * Maps a dashboard/mastery skill label to an exercise API category name.
 * Order: explicit config → exact name (case-insensitive) → partial substring match.
 */
export function resolveCategoryFromSkill(
  skill: string,
  availableCategories: string[],
): string {
  const normalizedSkill = skill.trim().toLowerCase();
  if (!normalizedSkill) return "";

  const mapped = MASTERY_SKILL_TO_EXERCISE_CATEGORY[normalizedSkill];
  if (mapped) {
    const found = availableCategories.find(
      (c) => c.toLowerCase() === mapped.toLowerCase(),
    );
    if (found) return found;
  }

  const exact = availableCategories.find(
    (category) => category.trim().toLowerCase() === normalizedSkill,
  );
  if (exact) return exact;

  const partial = availableCategories.find((category) => {
    const normalizedCategory = category.trim().toLowerCase();
    return (
      normalizedCategory.includes(normalizedSkill) ||
      normalizedSkill.includes(normalizedCategory)
    );
  });
  return partial || "";
}
