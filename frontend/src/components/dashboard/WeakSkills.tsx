import { useTranslation } from "react-i18next";
import { masteryLevelLabel, weakSkillNextStepLabels } from "@garzoni/core";
import type { WeakSkillNextStep } from "@garzoni/core";
import { formatPercentage } from "utils/format";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { GarzoniIcon } from "components/ui/garzoniIcons";

export type WeakSkill = {
  skill: string;
  course_id?: number | null;
  course_title?: string | null;
  proficiency: number;
  level_band?: string;
  level_label?: string;
  due_at?: string | null;
  last_reviewed?: string | null;
  is_due_now?: boolean;
  overdue_days?: number | null;
  delta_7d?: number | null;
  recommended_action?: "review" | "practice" | "lesson";
  review_exercise_id?: number | null;
  next_step?: WeakSkillNextStep | null;
};

type WeakSkillsProps = {
  show?: boolean;
  masteryError?: unknown;
  weakestSkills?: WeakSkill[];
  strongestSkills?: WeakSkill[];
  hasAnyMasteryData?: boolean;
  refetchMastery?: () => void;
  locale?: string;
  prefersReducedMotion?: boolean;
  onPrimaryAction?: (skill: WeakSkill) => void;
  onAskTutor?: (skill: WeakSkill) => void;
};

type PillKind = "due" | "overdue" | "declining" | "improving" | null;

function pillFor(skill: WeakSkill): {
  kind: PillKind;
  args?: Record<string, number>;
} {
  if (skill.is_due_now) {
    const days = skill.overdue_days ?? 0;
    if (days >= 1) return { kind: "overdue", args: { days } };
    return { kind: "due" };
  }
  const delta = skill.delta_7d ?? 0;
  if (delta <= -3) return { kind: "declining" };
  if (delta >= 3) return { kind: "improving", args: { delta } };
  return { kind: null };
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

const PILL_CLASS: Record<Exclude<PillKind, null>, string> = {
  due: "bg-red-500/15 text-red-400",
  overdue: "bg-red-500/15 text-red-400",
  declining: "bg-amber-500/15 text-amber-400",
  improving: "bg-emerald-500/15 text-emerald-400",
};

const WeakSkills = ({
  show = true,
  masteryError,
  weakestSkills = [],
  strongestSkills = [],
  hasAnyMasteryData = false,
  refetchMastery,
  locale,
  prefersReducedMotion,
  onPrimaryAction,
  onAskTutor,
}: WeakSkillsProps) => {
  const { t } = useTranslation();

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
              <GarzoniIcon
                name="target"
                size={44}
                className="text-[color:var(--color-brand-primary)]"
              />
            }
            title={t("dashboard.weakSkills.skillInsights")}
            description={t("dashboard.weakSkills.skillInsightsDesc")}
          />
        </div>
      );
    }
    // Strong-only state — surface top 3 strongest skills as a maintenance prompt.
    return (
      <div className="mt-6">
        <div className="rounded-xl border border-[color:var(--color-border-default)] bg-surface-card p-4 backdrop-blur-sm">
          <h2 className="mb-1 text-base font-semibold text-content-primary sm:text-lg">
            {t("dashboard.weakSkills.strongest.title")}
          </h2>
          <p className="mb-4 text-sm text-content-muted">
            {t("dashboard.weakSkills.strongest.subtitle")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {strongestSkills.slice(0, 3).map((skill) => (
              <div
                key={skill.skill}
                className="rounded-xl border border-[color:var(--color-border-default)] bg-surface-card p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-content-primary">
                    {skill.skill}
                  </span>
                  <span className="text-xs font-medium text-content-muted">
                    {formatPercentage(skill.proficiency, locale, 0)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${skill.proficiency}%` }}
                    role="progressbar"
                    aria-valuenow={skill.proficiency}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-[color:var(--color-border-default)] bg-surface-card p-4 backdrop-blur-sm">
        <h2 className="mb-1 text-base font-semibold text-content-primary sm:text-lg">
          {t("dashboard.weakSkills.areasToImprove")}
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          {t("dashboard.weakSkills.focusOnSkills")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weakestSkills.map((skill) => {
            const pill = pillFor(skill);
            const { ctaLabel, preview } = weakSkillNextStepLabels(
              t,
              skill.next_step
            );
            const displayTitle = skill.course_title || skill.skill;
            const isTutorOnly = skill.next_step?.type === "tutor";
            const primaryLabel = isTutorOnly
              ? t("dashboard.weakSkills.action.askTutorAbout", {
                  skill: displayTitle,
                })
              : ctaLabel;
            const isDue = skill.next_step?.type === "review";
            const lastDays = daysSince(skill.last_reviewed);
            return (
              <div
                key={skill.skill}
                className="group flex flex-col gap-2 rounded-xl border border-[color:var(--color-border-default)] bg-surface-card p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-content-primary">
                    {displayTitle}
                  </span>
                  <div className="flex items-center gap-2">
                    {pill.kind && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PILL_CLASS[pill.kind]}`}
                      >
                        {pill.kind === "due"
                          ? t("dashboard.weakSkills.pill.dueNow")
                          : pill.kind === "overdue"
                            ? t("dashboard.weakSkills.pill.overdue", pill.args)
                            : pill.kind === "declining"
                              ? t("dashboard.weakSkills.pill.declining")
                              : t(
                                  "dashboard.weakSkills.pill.improving",
                                  pill.args
                                )}
                      </span>
                    )}
                    <span className="text-xs font-medium text-content-muted">
                      {formatPercentage(skill.proficiency, locale, 0)}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-[color:var(--color-brand-primary,var(--color-brand-primary))] to-[color:var(--color-brand-primary,var(--color-brand-primary))]/70 ${
                      prefersReducedMotion ? "" : "transition-all duration-300"
                    }`}
                    style={{ width: `${skill.proficiency}%` }}
                    role="progressbar"
                    aria-valuenow={skill.proficiency}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                {(skill.level_band || skill.level_label) && (
                  <p className="text-[10px] font-medium uppercase tracking-wide text-content-muted">
                    {skill.level_band
                      ? masteryLevelLabel(t, skill.level_band)
                      : skill.level_label}
                  </p>
                )}
                {preview && (
                  <p className="text-xs text-content-muted">{preview}</p>
                )}
                {lastDays != null && (
                  <p className="text-xs text-content-muted">
                    {lastDays === 0
                      ? t("dashboard.weakSkills.context.lastPracticedToday")
                      : lastDays === 1
                        ? t(
                            "dashboard.weakSkills.context.lastPracticedYesterday"
                          )
                        : t("dashboard.weakSkills.context.lastPracticed", {
                            days: lastDays,
                          })}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPrimaryAction?.(skill)}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40 ${
                      isDue
                        ? "border-[color:var(--color-brand-primary)] bg-[color:var(--color-brand-primary)] text-white hover:shadow-md"
                        : "border-[color:var(--color-brand-primary)]/40 bg-transparent text-[color:var(--color-brand-primary-hover)] hover:bg-[color:var(--color-brand-primary)]/5"
                    }`}
                    aria-label={t("dashboard.weakSkills.practiceSkillAria", {
                      skill: skill.skill,
                    })}
                  >
                    {primaryLabel}
                  </button>
                  {!isTutorOnly && (
                    <button
                      type="button"
                      onClick={() => onAskTutor?.(skill)}
                      className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1.5 text-[11px] text-content-muted transition hover:border-[color:var(--color-brand-primary)]/40 hover:text-[color:var(--color-brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40"
                    >
                      {t("dashboard.weakSkills.action.askTutor")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeakSkills;
