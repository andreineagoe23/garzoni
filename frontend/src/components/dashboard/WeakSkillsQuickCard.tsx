import React from "react";
import { useTranslation } from "react-i18next";
import { formatPercentage } from "utils/format";
import { MonevoIcon } from "components/ui/monevoIcons";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

type WeakSkillsQuickCardProps = {
  locale?: string;
  topSkill?: WeakSkill | null;
  onPracticeSkill?: (skill: WeakSkill) => void;
  onExploreExercises: () => void;
};

export default function WeakSkillsQuickCard({
  locale,
  topSkill,
  onPracticeSkill,
  onExploreExercises,
}: WeakSkillsQuickCardProps) {
  const { t } = useTranslation();

  const hasSkill = Boolean(topSkill?.skill);
  const buttonDisabled = hasSkill && !onPracticeSkill;

  return (
    <div className="rounded-xl border border-[color:var(--primary,#1d5330)]/40 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/10 to-[color:var(--primary,#1d5330)]/5 p-4 transition-all">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl sm:text-2xl" aria-hidden="true">
            <MonevoIcon name="lightbulb" size={28} />
          </span>
          <div>
            <p className="text-sm sm:text-base font-semibold text-[color:var(--text-color,#111827)]">
              {t("dashboard.weakSkills.quickPracticeTitle")}
            </p>
            {hasSkill ? (
              <p className="text-[11px] sm:text-xs text-[color:var(--muted-text,#6b7280)]">
                {t("dashboard.weakSkills.lowMasteryIn", { skill: topSkill!.skill })} ·{" "}
                {formatPercentage(topSkill!.proficiency, locale, 0)}
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-[color:var(--muted-text,#6b7280)]">
                {t("dashboard.weakSkills.quickPracticeSubtitle")}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (hasSkill && topSkill && onPracticeSkill) {
              onPracticeSkill(topSkill);
            } else {
              onExploreExercises();
            }
          }}
          disabled={buttonDisabled}
          className={`rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:px-4 sm:py-2 sm:text-sm ${
            buttonDisabled ? "opacity-60 cursor-not-allowed hover:shadow-lg" : ""
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
