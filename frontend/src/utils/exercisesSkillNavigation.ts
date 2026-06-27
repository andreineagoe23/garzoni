import type { NavigateFunction } from "react-router-dom";

/** Navigation `state.reason` for dashboard → exercises deep links (analytics + banner context). */
export type ExercisesSkillReason =
  "weak_skill_click" | "weak_skill_practice" | "weak_skill_review";

const LEGACY_REASON_TO_CANONICAL: Record<string, ExercisesSkillReason> = {
  improve_weak_skill: "weak_skill_practice",
  // Old quick-card CTA — now folded into the unified weak-skill practice flow.
  quick_card_exercises: "weak_skill_practice",
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
    raw === "weak_skill_review"
  ) {
    return raw;
  }
  return undefined;
}

export type ExercisesSkillNavigationState = {
  from: "dashboard";
  targetSkill: string;
  reason: ExercisesSkillReason;
  exerciseId?: number | null;
};

/** Shared navigation target for dashboard → exercises skill recommendations. */
export function getExercisesSkillNavigation(
  skill: string,
  reason: ExercisesSkillReason,
  opts?: { exerciseId?: number | null }
) {
  let search = `?skill=${encodeURIComponent(skill)}`;
  if (opts?.exerciseId != null) {
    search += `&exerciseId=${opts.exerciseId}`;
  }
  return {
    pathname: "/exercises" as const,
    search,
    state: {
      from: "dashboard",
      targetSkill: skill,
      reason,
      exerciseId: opts?.exerciseId ?? null,
    } satisfies ExercisesSkillNavigationState,
  };
}

/** Single entry point so every dashboard CTA uses the same URL + state contract. */
export function navigateToExercisesFromDashboardSkill(
  navigate: NavigateFunction,
  skill: string,
  reason: ExercisesSkillReason,
  opts?: { exerciseId?: number | null }
) {
  const { pathname, search, state } = getExercisesSkillNavigation(
    skill,
    reason,
    opts
  );
  navigate({ pathname, search }, { state });
}

/**
 * Open the Chatbot widget with a preseeded message. Reuses the existing
 * `garzoni:tutor` event that the Chatbot widget already listens for in
 * `frontend/src/components/widgets/Chatbot.tsx`.
 */
export function askTutorAboutSkill(
  _skill: string,
  _proficiency: number,
  prompt: string
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("garzoni:tutor", { detail: { context: prompt } })
  );
}
