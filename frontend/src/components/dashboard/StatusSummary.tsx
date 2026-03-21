import React from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, formatPercentage } from "utils/format";
import { ErrorState } from "./ErrorState";
import { MonevoIcon } from "components/ui/monevoIcons";

type StatusSummaryProps = {
  coursesCompleted: number;
  overallProgress: number;
  reviewsDue: number;
  activeMissionsCount: number;
  dailyGoalProgress: number;
  dailyGoalTargetXP: number;
  streakCount?: number;
  reviewError?: unknown;
  missionsError?: unknown;
  refetchReview?: () => void;
  refetchMissions?: () => void;
  reviewQueueData?: unknown;
  locale?: string;
};

const StatusSummary = ({
  coursesCompleted,
  overallProgress,
  reviewsDue,
  activeMissionsCount,
  dailyGoalProgress,
  dailyGoalTargetXP,
  streakCount = 0,
  reviewError,
  missionsError,
  refetchReview,
  refetchMissions,
  reviewQueueData,
  locale,
}: StatusSummaryProps) => {
  const { t } = useTranslation();
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
          <MonevoIcon name="book" size={16} className="text-[color:var(--muted-text,#6b7280)]" />
          <span>{t("dashboard.statusSummary.coursesCompleted")}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {formatNumber(coursesCompleted, locale)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
          <MonevoIcon name="chartLine" size={16} className="text-[color:var(--muted-text,#6b7280)]" />
          <span>{t("dashboard.statusSummary.overallProgress")}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {formatPercentage(overallProgress, locale, 0)}
        </p>
      </div>
      {reviewError ? (
        <ErrorState
          title={t("dashboard.statusSummary.failedLoadReviews")}
          message={t("dashboard.statusSummary.couldNotFetchReviews")}
          onRetry={refetchReview}
          cachedData={reviewQueueData}
          className="sm:col-span-2 lg:col-span-1"
        />
      ) : (
        <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            <MonevoIcon name="sync" size={16} className="text-[color:var(--muted-text,#6b7280)]" />
            <span>{t("dashboard.statusSummary.reviewsDue")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {formatNumber(reviewsDue, locale)}
          </p>
        </div>
      )}
      {missionsError ? (
        <ErrorState
          title={t("dashboard.statusSummary.failedLoadMissions")}
          message={t("dashboard.statusSummary.couldNotFetchMissions")}
          onRetry={refetchMissions}
          className="sm:col-span-2 lg:col-span-1"
        />
      ) : (
        <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            <MonevoIcon name="rocket" size={16} className="text-[color:var(--muted-text,#6b7280)]" />
            <span>{t("dashboard.statusSummary.activeMissions")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {formatNumber(activeMissionsCount, locale)}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
          <MonevoIcon
            name="target"
            size={16}
            className="text-[color:var(--muted-text,#6b7280)]"
          />
          <span>{t("dashboard.dailyGoal.label", { xp: dailyGoalTargetXP })}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {formatPercentage(dailyGoalProgress, locale, 0)}
        </p>
      </div>

      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
          <MonevoIcon
            name="fire"
            size={16}
            className="text-[color:var(--muted-text,#6b7280)]"
          />
          <span>{t("dashboard.statusSummary.streak")}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {formatNumber(streakCount, locale)}
        </p>
      </div>
    </div>
  );
};

export default StatusSummary;
