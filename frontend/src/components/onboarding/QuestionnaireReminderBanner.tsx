import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchQuestionnaireProgress, type QuestionnaireProgress } from "services/questionnaireService";
import { GlassButton, GlassCard } from "components/ui";

const QuestionnaireReminderBanner: React.FC = () => {
  const navigate = useNavigate();

  const { data: progress } = useQuery<QuestionnaireProgress>({
    queryKey: ["questionnaire-progress"],
    queryFn: fetchQuestionnaireProgress,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Only show if progress exists and is incomplete
  if (!progress || progress.status !== "in_progress") {
    return null;
  }

  const completedSections = progress.completed_sections_count;
  const totalSections = progress.total_sections;

  return (
    <GlassCard
      padding="md"
      className="mb-6 border-[color:var(--primary,#2563eb)]/30 bg-gradient-to-r from-[color:var(--primary,#2563eb)]/10 to-[color:var(--primary,#2563eb)]/5"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-[color:var(--accent,#111827)]">
            Complete Your Onboarding
          </h3>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {completedSections} of {totalSections} sections complete ({progress.progress_percentage}%)
          </p>
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
        </div>
        <GlassButton
          variant="primary"
          size="sm"
          onClick={() => navigate("/onboarding")}
          aria-label="Resume questionnaire"
        >
          Resume Questionnaire
        </GlassButton>
      </div>
    </GlassCard>
  );
};

export default QuestionnaireReminderBanner;

