import type { NavigateFunction } from "react-router-dom";

/** Navigation `state.reason` for dashboard → exercises deep links (analytics + banner context). */
export type ExercisesSkillReason =
  | "weak_skill_click"
  | "weak_skill_practice"
  | "quick_card_exercises";

const LEGACY_REASON_TO_CANONICAL: Record<string, ExercisesSkillReason> = {
  improve_weak_skill: "weak_skill_practice",
};

/** Normalize legacy navigation state from older app versions. */
export function normalizeExercisesSkillReason(
  raw: string | undefined
): ExercisesSkillReason | undefined {
  if (!raw) return undefined;
  if (raw in LEGACY_REASON_TO_CANONICAL) {
    return LEGACY_REASON_TO_CANONICAL[raw];
  }
  if (
    raw === "weak_skill_click" ||
    raw === "weak_skill_practice" ||
    raw === "quick_card_exercises"
  ) {
    return raw;
  }
  return undefined;
}

export type ExercisesSkillNavigationState = {
  from: "dashboard";
  targetSkill: string;
  reason: ExercisesSkillReason;
};

/** Shared navigation target for dashboard → exercises skill recommendations. */
export function getExercisesSkillNavigation(
  skill: string,
  reason: ExercisesSkillReason
) {
  const search = `?skill=${encodeURIComponent(skill)}`;
  return {
    pathname: "/exercises" as const,
    search,
    state: {
      from: "dashboard",
      targetSkill: skill,
      reason,
    } satisfies ExercisesSkillNavigationState,
  };
}

/** Single entry point so every dashboard CTA uses the same URL + state contract. */
export function navigateToExercisesFromDashboardSkill(
  navigate: NavigateFunction,
  skill: string,
  reason: ExercisesSkillReason
) {
  const { pathname, search, state } = getExercisesSkillNavigation(skill, reason);
  navigate({ pathname, search }, { state });
}
