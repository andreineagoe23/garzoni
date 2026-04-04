import { useCallback } from "react";
import { router } from "expo-router";
import { href } from "../navigation/href";

export type DashboardWeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

export function navigateToExercisesFromDashboardSkill(skill: string) {
  router.push(href(`/(tabs)/exercises?skill=${encodeURIComponent(skill)}`));
}

export function useDashboardSkillExercisesNavigation() {
  const handleWeakSkillClick = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill);
  }, []);

  const handleWeakSkillPractice = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill);
  }, []);

  const handleQuickCardSkillExercises = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill);
  }, []);

  return {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleQuickCardSkillExercises,
  };
}
