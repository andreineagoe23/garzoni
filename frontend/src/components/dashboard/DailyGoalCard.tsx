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
    <div className={`app-card p-4 ${noMarginTop ? "" : "mt-6"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="app-icon-tile">
            <GarzoniIcon
              name="target"
              size={18}
              className="text-[color:var(--primary-bright,#2a7347)]"
            />
          </div>
          <span className="app-eyebrow">{t("dashboard.dailyGoal.label")}</span>
        </div>
        <span className="text-sm font-semibold text-content-primary">
          {formatPercentage(dailyGoalProgress, locale, 0)}
        </span>
      </div>
      <div className="app-progress-track">
        <div
          className={`app-progress-fill transition-[width] ${prefersReducedMotion ? "" : "duration-500"}`}
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
