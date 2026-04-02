import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatPercentage } from "utils/format";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

type EarlySkillInsightsProps = {
  overallProgress: number;
  completedLessons: number;
  totalLessons: number;
  completedSections: number;
  totalSections: number;
  weakestSkills: WeakSkill[];
  reviewsDue: number;
  activeMissionsCount: number;
  locale?: string;
  onNextStepClick: () => void;
  nextStepLabel: string;
  nextStepHint: string;
};

const EarlySkillInsights = ({
  overallProgress,
  completedLessons,
  totalLessons,
  completedSections,
  totalSections,
  weakestSkills,
  reviewsDue,
  activeMissionsCount,
  locale,
  onNextStepClick,
  nextStepLabel,
  nextStepHint,
}: EarlySkillInsightsProps) => {
  const { t } = useTranslation();
  const hasStarted = completedLessons > 0 || completedSections > 0;
  const prevHasStartedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [showJustUnlocked, setShowJustUnlocked] = useState(false);
  const firstSkill = weakestSkills[0];
  const earlyProgress = hasStarted
    ? Math.max(8, Math.round(overallProgress || 0))
    : 0;

  useEffect(() => {
    // Show the "Just unlocked" badge only when insights become available.
    const prevHasStarted = prevHasStartedRef.current;
    prevHasStartedRef.current = hasStarted;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!prevHasStarted && hasStarted) {
      setShowJustUnlocked(true);
      timerRef.current = window.setTimeout(
        () => setShowJustUnlocked(false),
        5000
      );
    } else {
      setShowJustUnlocked(false);
    }
  }, [hasStarted]);

  return (
    <div className="mt-6 rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
          {t("dashboard.skillInsights.title")}
        </p>
        {showJustUnlocked && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
            {t("dashboard.skillInsights.justUnlocked")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            {t("dashboard.skillInsights.foundation")}
          </p>
          <p className="mt-1 text-lg font-bold text-[color:var(--text-color,#111827)]">
            {formatPercentage(earlyProgress, locale, 0)}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted-text,#6b7280)]">
            {hasStarted
              ? t("dashboard.skillInsights.firstMilestone")
              : t("dashboard.skillInsights.completeFirstSection")}
          </p>
        </div>

        <div className="rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            {t("dashboard.skillInsights.currentFocus")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[color:var(--text-color,#111827)]">
            {firstSkill?.skill ||
              t("dashboard.skillInsights.learningFoundations")}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted-text,#6b7280)]">
            {firstSkill?.level_label ||
              t("dashboard.skillInsights.beginnerLevel")}
          </p>
        </div>

        <div className="rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            {t("dashboard.skillInsights.momentum")}
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-color,#111827)]">
            {reviewsDue > 0
              ? t("dashboard.skillInsights.reviewsDue", { count: reviewsDue })
              : t("dashboard.skillInsights.missionsActive", {
                  count: activeMissionsCount,
                })}
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted-text,#6b7280)]">
            {t("dashboard.skillInsights.sectionsAndLessons", {
              sections: `${completedSections}/${Math.max(1, totalSections)}`,
              lessons: `${completedLessons}/${Math.max(1, totalLessons)}`,
            })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
          {nextStepHint}
        </p>
        <button
          type="button"
          onClick={onNextStepClick}
          className="rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/25 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/35 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
        >
          {nextStepLabel}
        </button>
      </div>
    </div>
  );
};

export default EarlySkillInsights;
