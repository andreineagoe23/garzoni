export type WeakSkillNextStepType =
  "review" | "lesson" | "quiz" | "practice" | "tutor";

export type WeakSkillNextStep = {
  type: WeakSkillNextStepType;
  target_id: number | null;
  course_id: number | null;
  title: string | null;
};

type TFn = (key: string, options?: Record<string, unknown>) => string;

export function weakSkillNextStepLabels(
  t: TFn,
  nextStep?: WeakSkillNextStep | null,
): { ctaLabel: string; preview: string | null } {
  const ctaLabel = t("dashboard.weakSkills.action.continueImproving");

  if (!nextStep?.title) {
    return { ctaLabel, preview: null };
  }

  const typeKey = `dashboard.weakSkills.nextType.${nextStep.type}`;
  const typeLabel = t(typeKey);
  return {
    ctaLabel,
    preview: t("dashboard.weakSkills.nextPreview", {
      type: typeLabel,
      title: nextStep.title,
    }),
  };
}
