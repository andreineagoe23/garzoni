import React from "react";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import type { Mission, MissionActionKind } from "@garzoni/core";
import { getMissionPresentation } from "@garzoni/core";

type MissionCardProps = {
  mission: Mission;
  isDaily: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  canSwap: boolean;
  /** Level-aware fallback when the mission carries no `required_lessons`. */
  lessonRequirement: number;
  onSwap: (missionId: string | number) => void;
  /** Route CTAs navigate; savings/fact CTAs open the page-level action modal. */
  onAction: (mission: Mission, kind: MissionActionKind) => void;
};

/**
 * One mission = one action row: icon, name, progress fraction, XP, one CTA.
 * Description is clamped to a single line and the long-form "why this matters"
 * copy is gone — the board is a to-do list, not an article.
 */
const MissionCard = ({
  mission,
  isDaily,
  t,
  canSwap,
  lessonRequirement,
  onSwap,
  onAction,
}: MissionCardProps) => {
  const isCompleted = mission.status === "completed";
  const presentation = getMissionPresentation(mission, {
    isDaily,
    lessonRequirement,
  });
  const { percent, iconName, actionKind, ctaLabelKey } = presentation;
  const xp = mission.points_reward ?? 0;
  const titleId = `mission-title-${mission.id}`;

  if (isCompleted) {
    return (
      <div
        className="app-card app-card--pad-sm flex items-center gap-3 opacity-80"
        role="article"
        aria-labelledby={titleId}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <GarzoniIcon name="check" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            id={titleId}
            className="truncate text-sm font-semibold text-content-muted"
          >
            {mission.name}
          </p>
          <p className="text-xs text-content-muted">
            {t("missions.progress.completed")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
          {t("missions.xpPill", { xp })}
        </span>
      </div>
    );
  }

  return (
    <div
      className="app-card app-card--pad-sm flex flex-wrap items-center gap-x-4 gap-y-3"
      role="article"
      aria-labelledby={titleId}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-brand-primary)]/10 text-[color:var(--color-brand-primary)]">
        <GarzoniIcon name={iconName} size={18} />
      </span>

      <div className="min-w-0 flex-1 basis-48">
        <div className="flex items-baseline gap-2">
          <h3
            id={titleId}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-content-primary"
          >
            {mission.name}
          </h3>
          <span className="shrink-0 text-xs font-semibold text-[color:var(--color-brand-primary)]">
            {t("missions.xpPill", { xp })}
          </span>
        </div>

        <div
          className="app-progress-track mt-2"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("missions.progress.aria", { value: percent })}
        >
          <div className="app-progress-fill" style={{ width: `${percent}%` }} />
        </div>

        <p className="mt-1 truncate text-xs text-content-muted">
          {t(presentation.progressKey, presentation.progressParams)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {ctaLabelKey ? (
          <button
            type="button"
            onClick={() => onAction(mission, actionKind)}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40"
          >
            {t(ctaLabelKey)}
          </button>
        ) : null}
        {canSwap && isDaily ? (
          <button
            type="button"
            onClick={() => onSwap(mission.id)}
            title={t("missions.swap.label")}
            aria-label={t("missions.swap.aria", { name: mission.name })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border-default)] text-content-muted transition hover:border-[color:var(--color-brand-primary)]/40 hover:text-[color:var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40"
          >
            <GarzoniIcon name="sync" size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default React.memo(MissionCard);
