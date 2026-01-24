import React from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, formatPercentage } from "utils/format";
import { ErrorState } from "./ErrorState";

type StatusSummaryProps = {
  coursesCompleted: number;
  overallProgress: number;
  reviewsDue: number;
  activeMissionsCount: number;
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
  reviewError,
  missionsError,
  refetchReview,
  refetchMissions,
  reviewQueueData,
  locale,
}: StatusSummaryProps) => {
  const { t } = useTranslation("dashboard");
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
          <span aria-hidden="true">📚</span>
          <span>{t("coursesCompleted")}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {formatNumber(coursesCompleted, locale)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
          <span aria-hidden="true">📈</span>
          <span>{t("overallProgress")}</span>
        </div>
        <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
          {formatPercentage(overallProgress, locale, 0)}
        </p>
      </div>
      {reviewError ? (
        <ErrorState
          title={t("reviewsErrorTitle", { defaultValue: "Failed to load reviews" })}
          message={t("reviewsErrorMessage", {
            defaultValue: "We couldn't fetch your review queue.",
          })}
          onRetry={refetchReview}
          cachedData={reviewQueueData}
          className="sm:col-span-2 lg:col-span-1"
        />
      ) : (
        <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            <span aria-hidden="true">🔄</span>
            <span>{t("reviewsDue")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {formatNumber(reviewsDue, locale)}
          </p>
        </div>
      )}
      {missionsError ? (
        <ErrorState
          title={t("missionsErrorTitle", { defaultValue: "Failed to load missions" })}
          message={t("missionsErrorMessage", {
            defaultValue: "We couldn't fetch your missions.",
          })}
          onRetry={refetchMissions}
          className="sm:col-span-2 lg:col-span-1"
        />
      ) : (
        <div className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            <span aria-hidden="true">🎯</span>
            <span>{t("activeMissions")}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {formatNumber(activeMissionsCount, locale)}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatusSummary;
