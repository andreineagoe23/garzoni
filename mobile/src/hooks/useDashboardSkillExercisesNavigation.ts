import { useCallback } from "react";
import { router } from "expo-router";
import { href } from "../navigation/href";

export type DashboardWeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

/** Parity with web `ExercisesSkillReason` (navigation state). */
export type ExercisesSkillIntentReason =
  | "weak_skill_click"
  | "weak_skill_practice"
  | "quick_card_exercises";

export function navigateToExercisesFromDashboardSkill(
  skill: string,
  intentReason?: ExercisesSkillIntentReason,
) {
  const skillQ = `skill=${encodeURIComponent(skill)}`;
  const path = intentReason
    ? `/(tabs)/exercises?${skillQ}&intentReason=${encodeURIComponent(intentReason)}`
    : `/(tabs)/exercises?${skillQ}`;
  router.push(href(path));
}

export function useDashboardSkillExercisesNavigation() {
  const handleWeakSkillClick = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill, "weak_skill_click");
  }, []);

  const handleWeakSkillPractice = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill, "weak_skill_practice");
  }, []);

  const handleQuickCardSkillExercises = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill, "quick_card_exercises");
  }, []);

  return {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleQuickCardSkillExercises,
  };
}
