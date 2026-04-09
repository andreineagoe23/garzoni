import React from "react";
import { useTranslation } from "react-i18next";
import { formatPercentage } from "utils/format";
import { GarzoniIcon } from "components/ui/garzoniIcons";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

type WeakSkillsQuickCardProps = {
  locale?: string;
  topSkill?: WeakSkill | null;
  /** Primary CTA when a weak skill exists — must use the same navigation contract as other dashboard skill CTAs. */
  onRecommendedSkillExercises?: (skill: WeakSkill) => void;
  /** When there is no weak skill to recommend, open generic exercises browse. */
  onOpenExercises?: () => void;
};

export default function WeakSkillsQuickCard({
  locale,
  topSkill,
  onRecommendedSkillExercises,
  onOpenExercises,
}: WeakSkillsQuickCardProps) {
  const { t } = useTranslation();

  const hasSkill = Boolean(topSkill?.skill);
  const buttonDisabled = hasSkill && !onRecommendedSkillExercises;

  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--primary,#1d5330)]/40 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/10 to-[color:var(--primary,#1d5330)]/5 p-3 transition-all sm:p-4">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 flex-col items-center gap-2 text-center sm:flex-1 sm:flex-row sm:items-center sm:gap-3 sm:text-left">
          <span
            className="flex shrink-0 justify-center text-lg sm:text-2xl"
            aria-hidden="true"
          >
            <GarzoniIcon name="lightbulb" size={24} />
          </span>
          <div className="min-w-0 w-full sm:flex-1">
            <p className="break-words text-sm font-semibold text-content-primary sm:text-base">
              {t("dashboard.weakSkills.quickPracticeTitle")}
            </p>
            {hasSkill ? (
              <p className="break-words text-[11px] text-content-muted sm:text-xs">
                {t("dashboard.weakSkills.lowMasteryIn", {
                  skill: topSkill!.skill,
                })}{" "}
                · {formatPercentage(topSkill!.proficiency, locale, 0)}
              </p>
            ) : (
              <p className="break-words text-[11px] text-content-muted sm:text-xs">
                {t("dashboard.weakSkills.quickPracticeSubtitle")}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (hasSkill && topSkill && onRecommendedSkillExercises) {
              onRecommendedSkillExercises(topSkill);
            } else {
              onOpenExercises?.();
            }
          }}
          disabled={buttonDisabled}
          className={`w-full self-center rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1.5 text-center text-[11px] font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:w-auto sm:self-auto sm:px-4 sm:py-2 sm:text-sm ${
            buttonDisabled
              ? "opacity-60 cursor-not-allowed hover:shadow-lg"
              : ""
          }`}
          aria-label={
            hasSkill
              ? t("dashboard.weakSkills.practiceSkillAria", {
                  skill: topSkill!.skill,
                })
              : t("dashboard.weakSkills.practice")
          }
        >
          {t("dashboard.weakSkills.practice")}
        </button>
      </div>
    </div>
  );
}
