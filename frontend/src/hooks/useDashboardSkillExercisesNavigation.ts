import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { NavigateFunction } from "react-router-dom";
import type { WeakSkillNextStep } from "@garzoni/core";
import {
  askTutorAboutSkill,
  navigateToExercisesFromDashboardSkill,
} from "utils/exercisesSkillNavigation";
import type { AnalyticsEvent } from "types/analytics";

export type DashboardWeakSkill = {
  skill: string;
  course_id?: number | null;
  course_title?: string | null;
  proficiency: number;
  level_band?: string;
  level_label?: string;
  is_due_now?: boolean;
  overdue_days?: number | null;
  delta_7d?: number | null;
  recommended_action?: "review" | "practice" | "lesson";
  review_exercise_id?: number | null;
  next_step?: WeakSkillNextStep | null;
};

type TrackFn = (
  eventType: AnalyticsEvent,
  metadata?: Record<string, unknown>
) => void;

/**
 * Single place for dashboard → exercises (or tutor) skill CTAs so the navigation
 * contract and analytics stay aligned across weak-skill cards and the Resume row
 * top-skill shortcut.
 */
export function useDashboardSkillExercisesNavigation(
  navigate: NavigateFunction,
  trackEvent: TrackFn
) {
  const { t } = useTranslation();

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

  const handleWeakSkillReview = useCallback(
    (skill: DashboardWeakSkill) => {
      trackEvent("weak_skill_review_click", {
        skill: skill.skill,
        overdue_days: skill.overdue_days ?? 0,
      });
      navigateToExercisesFromDashboardSkill(
        navigate,
        skill.skill,
        "weak_skill_review",
        { exerciseId: skill.review_exercise_id ?? null }
      );
    },
    [navigate, trackEvent]
  );

  /** Server-driven: Review when due, else Practice. */
  const handleWeakSkillPrimaryAction = useCallback(
    (skill: DashboardWeakSkill) => {
      if (
        skill.recommended_action === "review" &&
        skill.review_exercise_id != null
      ) {
        handleWeakSkillReview(skill);
        return;
      }
      handleWeakSkillPractice(skill);
    },
    [handleWeakSkillReview, handleWeakSkillPractice]
  );

  const handleAskTutorAboutSkill = useCallback(
    (skill: DashboardWeakSkill) => {
      trackEvent("weak_skill_ask_tutor_click", {
        skill: skill.skill,
        proficiency: skill.proficiency,
      });
      const prompt = t("dashboard.weakSkills.tutorPrompt", {
        skill: skill.skill,
        pct: Math.round(skill.proficiency ?? 0),
      });
      askTutorAboutSkill(skill.skill, skill.proficiency, prompt);
    },
    [t, trackEvent]
  );

  /** Server-driven smart next step from mastery summary. */
  const handleContinueImproving = useCallback(
    (skill: DashboardWeakSkill) => {
      const step = skill.next_step;
      trackEvent("improve_recommendation_click", {
        skill: skill.skill,
        next_step_type: step?.type ?? skill.recommended_action ?? "practice",
        target_id: step?.target_id ?? skill.review_exercise_id ?? null,
      });

      if (!step) {
        handleWeakSkillPrimaryAction(skill);
        return;
      }

      switch (step.type) {
        case "review":
          navigateToExercisesFromDashboardSkill(
            navigate,
            skill.skill,
            "weak_skill_review",
            { exerciseId: step.target_id }
          );
          return;
        case "practice":
          navigateToExercisesFromDashboardSkill(
            navigate,
            skill.skill,
            "weak_skill_practice",
            { exerciseId: step.target_id }
          );
          return;
        case "lesson":
          if (step.course_id != null && step.target_id != null) {
            navigate(
              `/lessons/${step.course_id}/flow?lessonId=${step.target_id}`
            );
          }
          return;
        case "quiz":
          if (step.course_id != null) {
            navigate(`/quiz/${step.course_id}`);
          }
          return;
        case "tutor":
          handleAskTutorAboutSkill(skill);
          return;
        default:
          handleWeakSkillPrimaryAction(skill);
      }
    },
    [
      handleAskTutorAboutSkill,
      handleWeakSkillPrimaryAction,
      navigate,
      trackEvent,
    ]
  );

  const handleResumeTopSkillAction = useCallback(
    (skill: DashboardWeakSkill) => {
      trackEvent("dashboard_resume_practice_top_skill_click", {
        skill: skill.skill,
      });
      handleContinueImproving(skill);
    },
    [handleContinueImproving, trackEvent]
  );

  return {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleWeakSkillReview,
    handleWeakSkillPrimaryAction,
    handleContinueImproving,
    handleAskTutorAboutSkill,
    handleResumeTopSkillAction,
  };
}
