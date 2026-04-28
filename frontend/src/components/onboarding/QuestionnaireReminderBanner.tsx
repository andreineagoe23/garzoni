import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchQuestionnaireProgress,
  type QuestionnaireProgress,
} from "services/questionnaireService";
import { GlassButton, GlassCard } from "components/ui";

type QuestionnaireReminderBannerProps = {
  hasPaid: boolean;
  /** When true, auth is ready and we can safely fetch questionnaire progress (avoids 401 on refresh). */
  authReady?: boolean;
};

const QuestionnaireReminderBanner: React.FC<
  QuestionnaireReminderBannerProps
> = ({ hasPaid: _hasPaid, authReady = true }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    data: progress,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<QuestionnaireProgress>({
    queryKey: ["questionnaire-progress"],
    queryFn: () => fetchQuestionnaireProgress(),
    retry: 2,
    retryDelay: (attemptIndex) => (attemptIndex + 1) * 500,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchOnMount: true,
    enabled: authReady,
  });

  if (!authReady || (isLoading && !progress)) {
    return (
      <GlassCard padding="md" className="app-card mb-6">
        <div className="flex items-center gap-3 text-sm text-content-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--primary,#1d5330)] border-t-transparent" />
          {t("onboarding.reminderBanner.loading")}
        </div>
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard padding="md" className="app-card mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-content-muted">
            {t("onboarding.reminderBanner.error")}
          </p>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching
              ? t("onboarding.reminderBanner.retrying")
              : t("onboarding.reminderBanner.tryAgain")}
          </GlassButton>
        </div>
      </GlassCard>
    );
  }

  if (!progress) {
    return null;
  }

  const completedSections = progress.completed_sections_count ?? 0;
  const totalSections = Math.max(1, progress.total_sections ?? 0);
  const totalQuestions = progress.total_questions ?? 0;
  const currentQuestionNumber = progress.current_question_number ?? 0;
  const isCompleted = progress.status === "completed";
  // When onboarding is complete, don't show this banner; dashboard shows "Pick up where you left off" instead.
  if (isCompleted) {
    return null;
  }
  const primaryCtaLabel =
    completedSections > 0
      ? t("onboarding.reminderBanner.resume")
      : t("onboarding.reminderBanner.start");
  const primaryCtaTarget = "/onboarding";

  return (
    <GlassCard padding="md" className="app-card mb-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h3 className="app-eyebrow mb-1">
            {t("onboarding.reminderBanner.status")}
          </h3>
          <p className="text-xs text-content-muted">
            {isCompleted
              ? t("onboarding.reminderBanner.allSet")
              : totalQuestions > 0
                ? t("onboarding.reminderBanner.questionsComplete", {
                    done: Math.max(currentQuestionNumber - 1, 0),
                    total: totalQuestions,
                    percent: progress.progress_percentage ?? 0,
                  })
                : t("onboarding.reminderBanner.sectionsComplete", {
                    done: completedSections,
                    total: totalSections,
                    percent: progress.progress_percentage ?? 0,
                  })}
          </p>
          {!isCompleted && (
            <div className="app-progress-track mt-2">
              <div
                className="app-progress-fill"
                style={{
                  width: `${progress.progress_percentage}%`,
                  transition: "width 0.3s ease",
                }}
                role="progressbar"
                aria-valuenow={progress.progress_percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}
        </div>
        <GlassButton
          variant="primary"
          size="sm"
          onClick={() => navigate(primaryCtaTarget)}
          aria-label={t("onboarding.reminderBanner.viewStatus")}
        >
          {primaryCtaLabel}
        </GlassButton>
      </div>
    </GlassCard>
  );
};

export default QuestionnaireReminderBanner;
