import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";
import { navigateToExercisesFromDashboardSkill } from "utils/exercisesSkillNavigation";
import type { AnalyticsEvent } from "types/analytics";

export type DashboardWeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

type TrackFn = (
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>
) => void;

/**
 * Single place for dashboard → exercises skill CTAs so navigation contract and
 * analytics stay aligned (weak card, practice, quick card).
 */
export function useDashboardSkillExercisesNavigation(
  navigate: NavigateFunction,
  trackEvent: TrackFn
) {
  const handleWeakSkillClick = useCallback(
    (skill: DashboardWeakSkill) => {
      trackEvent("weak_skill_click", {
        skill: skill.skill,
        proficiency: skill.proficiency,
      });
      navigateToExercisesFromDashboardSkill(
        navigate,
        skill.skill,
        "weak_skill_click"
      );
    },
    [navigate, trackEvent]
  );

  const handleWeakSkillPractice = useCallback(
    (skill: DashboardWeakSkill) => {
      trackEvent("improve_recommendation_click", { skill: skill.skill });
      navigateToExercisesFromDashboardSkill(
        navigate,
        skill.skill,
        "weak_skill_practice"
      );
    },
    [navigate, trackEvent]
  );

  const handleQuickCardSkillExercises = useCallback(
    (skill: DashboardWeakSkill) => {
      trackEvent("quick_card_exercises_click", {
        skill: skill.skill,
        proficiency: skill.proficiency,
      });
      navigateToExercisesFromDashboardSkill(
        navigate,
        skill.skill,
        "quick_card_exercises"
      );
    },
    [navigate, trackEvent]
  );

  return {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleQuickCardSkillExercises,
  };
}
