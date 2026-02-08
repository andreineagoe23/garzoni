import React from "react";
import { formatPercentage } from "utils/format";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

type WeakSkill = {
  skill: string;
  proficiency: number;
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
}: WeakSkillsProps) => {
  if (!show) return null;

  if (masteryError) {
    return (
      <div className="mt-6">
        <ErrorState
          title="Failed to load skills"
          message="We couldn't fetch your skill mastery data."
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
            icon="🎯"
            title="Skill insights"
            description="Complete lessons and quizzes to see your skill strengths and areas to improve."
          />
        </div>
      );
    }
    return (
      <div className="mt-6">
        <EmptyState
          icon="🎯"
          title="No Weak Skills"
          description="Great job! You're doing well across all skills."
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            🎯
          </span>
          <span className="text-sm font-medium text-[color:var(--text-color,#111827)]">
            Areas to Improve
          </span>
        </div>
        <p className="mb-4 text-sm text-[color:var(--muted-text,#6b7280)]">
          Focus on these skills to boost your overall mastery
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {weakestSkills.map((skill) => (
            <div
              key={skill.skill}
              className="group rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-3 text-left transition hover:border-[color:var(--error,#dc2626)]/40 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => onSkillClick?.(skill)}
                className="w-full rounded text-left focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                aria-label={`Practice ${skill.skill} skill`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
                    {skill.skill}
                  </span>
                  <span className="text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
                    {formatPercentage(skill.proficiency, locale, 0)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-[color:var(--error,#dc2626)] to-[color:var(--error,#dc2626)]/70 transition-all ${
                      prefersReducedMotion ? "" : "duration-300"
                    }`}
                    style={{ width: `${skill.proficiency}%` }}
                    role="progressbar"
                    aria-valuenow={skill.proficiency}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)] transition group-hover:text-[color:var(--error,#dc2626)]">
                  Low mastery in {skill.skill}
                </p>
              </button>
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPracticeClick?.(skill);
                  }}
                  className="rounded bg-transparent p-0 text-[10px] text-[color:var(--muted-text,#6b7280)] underline hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                  aria-label={`Practice ${skill.skill} to improve this recommendation`}
                >
                  Practice
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
