import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatPercentage } from "utils/format";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { MonevoIcon } from "components/ui/monevoIcons";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

type WeakSkillsProps = {
  show?: boolean;
  masteryError?: unknown;
  weakestSkills?: WeakSkill[];
  /** When false, user has no mastery data yet (no lessons done); show a different empty state. */
  hasAnyMasteryData?: boolean;
  refetchMastery?: () => void;
  locale?: string;
  prefersReducedMotion?: boolean;
  onSkillClick?: (skill: WeakSkill) => void;
  onPracticeClick?: (skill: WeakSkill) => void;
  completedSections?: number;
  totalSections?: number;
  completedLessons?: number;
  totalLessons?: number;
};

const WeakSkills = ({
  show = true,
  masteryError,
  weakestSkills = [],
  hasAnyMasteryData = false,
  refetchMastery,
  locale,
  prefersReducedMotion,
  onSkillClick,
  onPracticeClick,
  completedSections,
  totalSections,
  completedLessons,
  totalLessons,
}: WeakSkillsProps) => {
  const { t } = useTranslation();

  const JUST_UNLOCKED_THRESHOLD = 20;
  const [justUnlockedSkills, setJustUnlockedSkills] = useState<Set<string>>(
    () => new Set()
  );
  const prevProficiencyMapRef = useRef<Map<string, number>>(new Map());
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Keep the "Just unlocked" badge meaningful:
    // - show it only when a skill appears for the first time
    //   or crosses from "higher proficiency" -> "<= threshold".
    const nextMap = new Map<string, number>(
      weakestSkills.map((s) => [s.skill, s.proficiency])
    );

    const prevMap = prevProficiencyMapRef.current;
    const newlyUnlocked = new Set<string>();

    for (const [skill, proficiency] of nextMap.entries()) {
      if (proficiency > JUST_UNLOCKED_THRESHOLD) continue;
      const prevProficiency = prevMap.get(skill);
      if (
        prevProficiency === undefined ||
        prevProficiency > JUST_UNLOCKED_THRESHOLD
      ) {
        newlyUnlocked.add(skill);
      }
    }

    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    setJustUnlockedSkills(newlyUnlocked);
    prevProficiencyMapRef.current = nextMap;

    // Auto-clear so it can't stay forever.
    if (newlyUnlocked.size > 0) {
      clearTimerRef.current = window.setTimeout(
        () => setJustUnlockedSkills(new Set()),
        5000
      );
    }
  }, [weakestSkills]);

  if (!show) return null;

  if (masteryError) {
    return (
      <div className="mt-6">
        <ErrorState
          title={t("dashboard.weakSkills.failedLoadSkills")}
          message={t("dashboard.weakSkills.couldNotFetchSkills")}
          onRetry={refetchMastery}
        />
      </div>
    );
  }

  if (weakestSkills.length === 0) {
    if (!hasAnyMasteryData) {
      return (
        <div className="mt-6">
          <EmptyState
            icon={
              <MonevoIcon
                name="target"
                size={44}
                className="text-[color:var(--primary,#1d5330)]"
              />
            }
            title={t("dashboard.weakSkills.skillInsights")}
            description={t("dashboard.weakSkills.skillInsightsDesc")}
          />
        </div>
      );
    }
    return (
      <div className="mt-6">
        <EmptyState
          icon={
            <MonevoIcon
              name="target"
              size={44}
              className="text-[color:var(--primary,#1d5330)]"
            />
          }
          title={t("dashboard.weakSkills.noWeakSkills")}
          description={t("dashboard.weakSkills.noWeakSkillsDesc")}
        />
      </div>
    );
  }

  const safeCompletedSections = completedSections ?? 0;
  const safeTotalSections = totalSections ?? 0;
  const safeCompletedLessons = completedLessons ?? 0;
  const safeTotalLessons = totalLessons ?? 0;

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[color:var(--text-color,#111827)] sm:text-lg">
            {t("dashboard.weakSkills.areasToImprove")}
          </h2>
        </div>
        <p className="mb-2 text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("dashboard.weakSkills.focusOnSkills")}
        </p>
        <p className="mb-4 text-[11px] text-[color:var(--muted-text,#6b7280)]">
          {t("dashboard.skillInsights.sectionsAndLessons", {
            sections: `${safeCompletedSections}/${Math.max(1, safeTotalSections)}`,
            lessons: `${safeCompletedLessons}/${Math.max(1, safeTotalLessons)}`,
          })}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {weakestSkills.map((skill) => (
            <div
              key={skill.skill}
              className="group rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-3 text-left transition hover:border-[color:var(--color-brand-primary,var(--primary,#1d5330))]/40 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => onSkillClick?.(skill)}
                className="w-full rounded text-left focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ring-focus,var(--primary,#1d5330))]/40"
                aria-label={t("dashboard.weakSkills.practiceSkillAria", {
                  skill: skill.skill,
                })}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                    {skill.skill}
                  </span>
                  <div className="flex items-center gap-2">
                    {justUnlockedSkills.has(skill.skill) && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">
                        {t("dashboard.skillInsights.justUnlocked")}
                      </span>
                    )}
                    <span className="text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
                      {formatPercentage(skill.proficiency, locale, 0)}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-[color:var(--color-brand-primary,var(--primary,#1d5330))] to-[color:var(--color-brand-primary,var(--primary,#1d5330))]/70 transition-all ${
                      prefersReducedMotion ? "" : "duration-300"
                    }`}
                    style={{ width: `${skill.proficiency}%` }}
                    role="progressbar"
                    aria-valuenow={skill.proficiency}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)] transition group-hover:text-[color:var(--color-brand-primary,var(--primary,#1d5330))]">
                  {t("dashboard.weakSkills.lowMasteryIn", {
                    skill: skill.skill,
                  })}
                </p>
                {skill.level_label && (
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    {skill.level_label}
                  </p>
                )}
              </button>
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPracticeClick?.(skill);
                  }}
                  className="rounded bg-transparent p-0 text-[10px] text-[color:var(--muted-text,#6b7280)] underline hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                  aria-label={t(
                    "dashboard.weakSkills.practiceRecommendationAria",
                    { skill: skill.skill }
                  )}
                >
                  {t("dashboard.weakSkills.practice")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeakSkills;
