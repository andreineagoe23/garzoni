import React from "react";
import { useTranslation } from "react-i18next";
import { formatPercentage } from "utils/format";
import { GarzoniIcon } from "components/ui/garzoniIcons";

type DailyGoalCardProps = {
  dailyGoalProgress: number;
  locale?: string;
  prefersReducedMotion?: boolean;
  /** When true, omit top margin (e.g. when embedded in a shared container). */
  noMarginTop?: boolean;
};

const DailyGoalCard = ({
  dailyGoalProgress,
  locale,
  prefersReducedMotion,
  noMarginTop,
}: DailyGoalCardProps) => {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm ${noMarginTop ? "" : "mt-6"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GarzoniIcon
            name="target"
            size={20}
            className="text-[color:var(--primary,#1d5330)]"
          />
          <span className="text-sm font-medium text-[color:var(--text-color,#111827)]">
            {t("dashboard.dailyGoal.label")}
          </span>
        </div>
        <span className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
          {formatPercentage(dailyGoalProgress, locale, 0)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#1d5330)] to-[color:var(--primary,#1d5330)]/70 transition-[width] ${
            prefersReducedMotion ? "" : "duration-500"
          }`}
          style={{ width: `${dailyGoalProgress}%` }}
          role="progressbar"
          aria-valuenow={dailyGoalProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${t("dashboard.dailyGoal.label")}: ${formatPercentage(dailyGoalProgress, locale, 0)} complete`}
        />
      </div>
    </div>
  );
};

export default DailyGoalCard;
