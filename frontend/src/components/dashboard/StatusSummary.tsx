import React from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, formatPercentage } from "utils/format";
import { ErrorState } from "./ErrorState";
import { MonevoIcon } from "components/ui/monevoIcons";
import StatBadge from "components/common/StatBadge";

type StatusSummaryProps = {
  coursesCompleted: number;
  overallProgress: number;
  reviewsDue: number;
  activeMissionsCount: number;
  dailyGoalProgress: number;
  streakCount?: number;
  reviewError?: unknown;
  missionsError?: unknown;
  refetchReview?: () => void;
  refetchMissions?: () => void;
  reviewQueueData?: unknown;
  reviewTopSkill?: string | null;
  onOpenReviews?: () => void;
  locale?: string;
};

const StatusSummary = ({
  coursesCompleted,
  overallProgress,
  reviewsDue,
  activeMissionsCount,
  dailyGoalProgress,
  streakCount = 0,
  reviewError,
  missionsError,
  refetchReview,
  refetchMissions,
  reviewQueueData,
  reviewTopSkill,
  onOpenReviews,
  locale,
}: StatusSummaryProps) => {
  const { t } = useTranslation();
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatBadge
        label={t("dashboard.dailyGoal.label")}
        value={formatPercentage(dailyGoalProgress, locale, 0)}
      />
      <StatBadge
        label={t("dashboard.statusSummary.overallProgress")}
        value={formatPercentage(overallProgress, locale, 0)}
      />
      <StatBadge
        label={t("dashboard.statusSummary.coursesCompleted")}
        value={formatNumber(coursesCompleted, locale)}
      />
      {reviewError ? (
        <ErrorState
          title={t("dashboard.statusSummary.failedLoadReviews")}
          message={t("dashboard.statusSummary.couldNotFetchReviews")}
          onRetry={refetchReview}
          cachedData={reviewQueueData}
          className="sm:col-span-2 lg:col-span-1"
        />
      ) : (
        <div
          className={`rounded-xl border p-4 backdrop-blur-sm transition ${
            reviewsDue > 0
              ? "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 shadow-lg shadow-[color:var(--error,#dc2626)]/20"
              : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`flex items-center gap-2 text-sm font-medium ${reviewsDue > 0 ? "text-[color:var(--error,#dc2626)]" : "text-[color:var(--muted-text,#6b7280)]"}`}>
              <MonevoIcon name="sync" size={16} className={reviewsDue > 0 ? "text-[color:var(--error,#dc2626)]" : "text-[color:var(--muted-text,#6b7280)]"} />
              <span>{t("dashboard.statusSummary.reviewsDue")}</span>
            </div>
            {reviewsDue > 0 ? (
              <span className="inline-flex items-center rounded-full bg-[color:var(--error,#dc2626)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--error,#dc2626)] animate-pulse">
                {t("dashboard.statusSummary.urgent")}
              </span>
            ) : null}
          </div>
          <p className={`mt-2 text-2xl font-bold ${reviewsDue > 0 ? "text-[color:var(--error,#dc2626)]" : "text-[color:var(--text-color,#111827)]"}`}>
            {formatNumber(reviewsDue, locale)}
          </p>
          {reviewTopSkill ? (
            <p className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
              {t("dashboard.statusSummary.nextReviewSkill", { skill: reviewTopSkill })}
            </p>
          ) : null}
          {onOpenReviews && reviewsDue > 0 ? (
            <button
              type="button"
              onClick={onOpenReviews}
              className="mt-3 inline-flex items-center rounded-full border border-[color:var(--error,#dc2626)]/40 bg-white/70 px-3 py-1 text-xs font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white"
            >
              {t("dashboard.statusSummary.startReviews")}
            </button>
          ) : null}
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
