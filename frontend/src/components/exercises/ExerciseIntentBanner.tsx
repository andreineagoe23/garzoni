import React from "react";
import { useTranslation } from "react-i18next";

export type ExerciseIntentBannerModel =
  | {
      kind: "applied";
      skill: string;
      category: string;
      /** True when resolved category label differs from dashboard skill text. */
      differsFromSkill: boolean;
    }
  | { kind: "unmapped"; skill: string };

type ExerciseIntentBannerProps = {
  model: ExerciseIntentBannerModel;
  /** Optional line under the title (e.g. why the user landed here from the dashboard). */
  contextSubtitle?: string;
  dismissed: boolean;
  onClearFilter: () => void;
  onDismissRecommendation: () => void;
  onChangeCategory: () => void;
  showClearFilter: boolean;
};

/**
 * Dashboard → exercises bridge: explains focus, gives recovery actions, accessible contrast.
 */
export default function ExerciseIntentBanner({
  model,
  contextSubtitle,
  dismissed,
  onClearFilter,
  onDismissRecommendation,
  onChangeCategory,
  showClearFilter,
}: ExerciseIntentBannerProps) {
  const { t } = useTranslation();

  if (dismissed) return null;

  const title =
    model.kind === "applied"
      ? model.differsFromSkill
        ? t("exercises.skillIntent.titleMappedDiffers", {
            category: model.category,
            skill: model.skill,
          })
        : t("exercises.skillIntent.titleMapped", {
            category: model.category,
            skill: model.skill,
          })
      : t("exercises.skillIntent.titleUnmapped", { skill: model.skill });

  const body =
    model.kind === "applied"
      ? t("exercises.skillIntent.bodyMapped")
      : t("exercises.skillIntent.bodyUnmapped");

  return (
    <div
      role="region"
      aria-label={t("exercises.skillIntent.regionLabel")}
      className="mb-4 rounded-2xl border border-[color:var(--primary,#1d5330)]/45 bg-[color:var(--primary,#1d5330)]/12 px-4 py-3 text-sm text-[color:var(--text-color,#111827)] shadow-sm shadow-[color:var(--primary,#1d5330)]/10"
    >
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-semibold leading-snug text-[color:var(--text-color,#111827)]">
            {title}
          </p>
          {contextSubtitle ? (
            <p className="text-xs leading-relaxed text-[color:var(--muted-text,#4b5563)]">
              {contextSubtitle}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-[color:var(--muted-text,#4b5563)] sm:text-sm">
            {body}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onChangeCategory}
            className="order-3 w-full rounded-full border border-[color:var(--primary,#1d5330)]/55 bg-[color:var(--card-bg,#ffffff)]/95 px-3 py-1.5 text-center text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/35 sm:order-1 sm:w-auto"
          >
            {t("exercises.skillIntent.changeCategory")}
          </button>
          {showClearFilter ? (
            <button
              type="button"
              onClick={onClearFilter}
              className="order-1 w-full rounded-full border border-[color:var(--primary,#1d5330)]/55 bg-[color:var(--card-bg,#ffffff)]/95 px-3 py-1.5 text-center text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/35 sm:order-2 sm:w-auto"
            >
              {t("exercises.skillIntent.clearFilter")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismissRecommendation}
            className="order-2 w-full rounded-full border border-[color:var(--border-color,#6b7280)]/50 bg-[color:var(--card-bg,#ffffff)]/90 px-3 py-1.5 text-center text-xs font-semibold text-[color:var(--muted-text,#4b5563)] transition hover:border-[color:var(--primary,#1d5330)]/45 hover:text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/25 sm:order-3 sm:w-auto"
          >
            {t("exercises.skillIntent.dismissRecommendation")}
          </button>
        </div>
      </div>
    </div>
  );
}
