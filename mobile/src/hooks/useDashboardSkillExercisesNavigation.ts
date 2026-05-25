import { useCallback } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import type { WeakSkillNextStep } from "@garzoni/core";
import { href } from "../navigation/href";

export type DashboardWeakSkill = {
  skill: string;
  course_id?: number | null;
  course_title?: string | null;
  proficiency: number;
  level_band?: string;
  level_label?: string;
  last_reviewed?: string | null;
  is_due_now?: boolean;
  overdue_days?: number | null;
  delta_7d?: number | null;
  recommended_action?: "review" | "practice" | "lesson";
  review_exercise_id?: number | null;
  next_step?: WeakSkillNextStep | null;
};

/** Parity with web `ExercisesSkillReason` (navigation state). */
export type ExercisesSkillIntentReason =
  | "weak_skill_click"
  | "weak_skill_practice"
  | "weak_skill_review";

export function navigateToExercisesFromDashboardSkill(
  skill: string,
  intentReason?: ExercisesSkillIntentReason,
  opts?: { exerciseId?: number | null },
) {
  const params: string[] = [`skill=${encodeURIComponent(skill)}`];
  if (intentReason)
    params.push(`intentReason=${encodeURIComponent(intentReason)}`);
  if (opts?.exerciseId != null) params.push(`exerciseId=${opts.exerciseId}`);
  router.push(href(`/(tabs)/exercises?${params.join("&")}`));
}

export function navigateToTutorForSkill(prompt: string) {
  router.push(href(`/chat?preseededMessage=${encodeURIComponent(prompt)}`));
}

export function navigateToWeakSkillNextStep(
  skill: DashboardWeakSkill,
  nextStep: WeakSkillNextStep,
) {
  switch (nextStep.type) {
    case "review":
      navigateToExercisesFromDashboardSkill(skill.skill, "weak_skill_review", {
        exerciseId: nextStep.target_id,
      });
      return;
    case "practice":
      navigateToExercisesFromDashboardSkill(
        skill.skill,
        "weak_skill_practice",
        {
          exerciseId: nextStep.target_id,
        },
      );
      return;
    case "lesson":
      if (nextStep.course_id != null && nextStep.target_id != null) {
        router.push(
          href(`/flow/${nextStep.course_id}?lessonId=${nextStep.target_id}`),
        );
      }
      return;
    case "quiz":
      if (nextStep.course_id != null) {
        router.push(href(`/quiz/${nextStep.course_id}`));
      }
      return;
    case "tutor": {
      const prompt = `Help me improve ${skill.skill} — I'm at ${Math.round(skill.proficiency ?? 0)}% mastery. What should I focus on next?`;
      navigateToTutorForSkill(prompt);
      return;
    }
    default:
      navigateToExercisesFromDashboardSkill(skill.skill, "weak_skill_practice");
  }
}

export function useDashboardSkillExercisesNavigation() {
  const { t } = useTranslation("common");

  const handleWeakSkillClick = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill, "weak_skill_click");
  }, []);

  const handleWeakSkillPractice = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill, "weak_skill_practice");
  }, []);

  const handleWeakSkillReview = useCallback((s: DashboardWeakSkill) => {
    navigateToExercisesFromDashboardSkill(s.skill, "weak_skill_review", {
      exerciseId: s.review_exercise_id ?? null,
    });
  }, []);

  /** Routes by the server-suggested action — Review when due, else Practice. */
  const handleWeakSkillPrimaryAction = useCallback(
    (s: DashboardWeakSkill) => {
      if (s.recommended_action === "review" && s.review_exercise_id != null) {
        handleWeakSkillReview(s);
        return;
      }
      handleWeakSkillPractice(s);
    },
    [handleWeakSkillReview, handleWeakSkillPractice],
  );

  const handleAskTutorAboutSkill = useCallback(
    (s: DashboardWeakSkill) => {
      const prompt = t("dashboard.weakSkills.tutorPrompt", {
        skill: s.skill,
        pct: Math.round(s.proficiency ?? 0),
      });
      navigateToTutorForSkill(prompt);
    },
    [t],
  );

  /** Server-driven smart next step from mastery summary. */
  const handleContinueImproving = useCallback(
    (s: DashboardWeakSkill) => {
      const step = s.next_step;
      const targetId = step?.target_id ?? s.review_exercise_id;
      void import("../bootstrap/customerIoMobile").then(
        ({ trackGarzoniEvent }) =>
          trackGarzoniEvent("improve_recommendation_click", {
            skill: s.skill,
            next_step_type: step?.type ?? s.recommended_action ?? "practice",
            ...(targetId != null ? { target_id: targetId } : {}),
          }),
      );
      if (!step) {
        handleWeakSkillPrimaryAction(s);
        return;
      }
      navigateToWeakSkillNextStep(s, step);
    },
    [handleWeakSkillPrimaryAction],
  );

  return {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleWeakSkillReview,
    handleWeakSkillPrimaryAction,
    handleContinueImproving,
    handleAskTutorAboutSkill,
  };
}
