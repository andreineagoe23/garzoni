import React from "react";
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

const QuestionnaireReminderBanner: React.FC<QuestionnaireReminderBannerProps> = ({
  hasPaid,
  authReady = true,
}) => {
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
      <GlassCard
        padding="md"
        className="mb-6 border-[color:var(--primary,#2563eb)]/30 bg-gradient-to-r from-[color:var(--primary,#2563eb)]/10 to-[color:var(--primary,#2563eb)]/5"
      >
        <div className="flex items-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--primary,#2563eb)] border-t-transparent" />
          Loading onboarding status…
        </div>
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard
        padding="md"
        className="mb-6 border-[color:var(--primary,#2563eb)]/30 bg-gradient-to-r from-[color:var(--primary,#2563eb)]/10 to-[color:var(--primary,#2563eb)]/5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Couldn&apos;t load onboarding status.
          </p>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? "Retrying…" : "Try again"}
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
  const primaryCtaLabel = isCompleted
    ? hasPaid
      ? "View Personalized Path"
      : "Choose a Plan"
    : completedSections > 0
      ? "Resume Onboarding"
      : "Start Onboarding";
  const primaryCtaTarget = isCompleted
    ? hasPaid
      ? "/personalized-path"
      : "/subscriptions"
    : "/onboarding";

  return (
    <GlassCard
      padding="md"
      className="mb-6 border-[color:var(--primary,#2563eb)]/30 bg-gradient-to-r from-[color:var(--primary,#2563eb)]/10 to-[color:var(--primary,#2563eb)]/5"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-[color:var(--accent,#111827)]">
            Onboarding Status
          </h3>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {isCompleted
              ? "You're all set. Your onboarding is complete."
              : totalQuestions > 0
                ? `${Math.max(currentQuestionNumber - 1, 0)} of ${totalQuestions} questions complete (${progress.progress_percentage ?? 0}%)`
                : `${completedSections} of ${totalSections} section${totalSections !== 1 ? "s" : ""} complete (${progress.progress_percentage ?? 0}%)`}
          </p>
          {!isCompleted && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/80 transition-[width] duration-300"
                style={{ width: `${progress.progress_percentage}%` }}
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
          aria-label="View onboarding status"
        >
          {primaryCtaLabel}
        </GlassButton>
      </div>
    </GlassCard>
  );
};

export default QuestionnaireReminderBanner;
