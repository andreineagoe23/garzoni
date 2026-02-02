import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAnalytics } from "hooks/useAnalytics";
import Loader from "components/common/Loader";
import { GlassCard, GlassButton } from "components/ui";
import {
  fetchQuestionnaireProgress,
  fetchNextQuestion,
  saveAnswer,
  completeQuestionnaire,
  abandonQuestionnaire,
  type QuestionnaireProgress,
  type NextQuestionResponse,
  type QuestionnaireQuestion,
} from "services/questionnaireService";
import QuestionnaireCompletionModal from "./QuestionnaireCompletionModal";
import toast from "react-hot-toast";
import { calculatePercent } from "utils/progress";

/** Short questionnaire has 6 questions; fallback if API doesn't send total */
const DEFAULT_TOTAL_QUESTIONS = 6;

const OnboardingQuestionnaire: React.FC = () => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const queryClient = useQueryClient();
  const questionStartTimeRef = useRef<number>(Date.now());

  const [currentQuestion, setCurrentQuestion] = useState<QuestionnaireQuestion | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<unknown>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionRewards, setCompletionRewards] = useState<{ xp: number; coins: number } | null>(null);
  const [sectionSummary, setSectionSummary] = useState<NextQuestionResponse["section_summary"] | null>(null);

  // Fetch progress
  const {
    data: progress,
    isLoading: isLoadingProgress,
    isError: isProgressError,
    error: progressError,
    refetch: refetchProgress,
  } = useQuery<QuestionnaireProgress>({
    queryKey: ["questionnaire-progress"],
    queryFn: () => fetchQuestionnaireProgress(),
    retry: 1,
  });

  // Fetch next question (also when "abandoned" so user can resume)
  const isProgressActive =
    !!progress &&
    (progress.status === "in_progress" || progress.status === "abandoned");
  const {
    data: nextQuestionData,
    isLoading: isLoadingQuestion,
    isError: isNextQuestionError,
    error: nextQuestionError,
    refetch: refetchNextQuestion,
  } = useQuery<NextQuestionResponse>({
    queryKey: ["questionnaire-next-question"],
    queryFn: () => fetchNextQuestion(),
    enabled: isProgressActive,
    retry: 1,
  });

  // Progress bar: same pattern as CourseFlowPage — completed count / total (from answers count)
  const totalQuestionsDisplay =
    (progress?.total_questions ?? nextQuestionData?.total_questions) || DEFAULT_TOTAL_QUESTIONS;
  const answersCount = progress?.answers ? Object.keys(progress.answers).length : 0;
  const currentQuestionNumberDisplay = Math.min(answersCount + 1, totalQuestionsDisplay);
  const computedProgressPercentage = calculatePercent(answersCount, totalQuestionsDisplay, { round: true });
  const computedIsLastQuestion = currentQuestionNumberDisplay >= totalQuestionsDisplay;

  // Update state when next question data arrives
  useEffect(() => {
    if (nextQuestionData?.question) {
      setCurrentQuestion(nextQuestionData.question);
      setSectionIndex(nextQuestionData.section_index);
      setQuestionIndex(nextQuestionData.question_index);
      setTotalSections(nextQuestionData.total_sections);
      setTotalQuestions(nextQuestionData.total_questions ?? 0);
      setCurrentQuestionNumber(nextQuestionData.current_question_number ?? 0);
      setProgressPercentage(nextQuestionData.progress_percentage ?? 0);
      setIsLastQuestion(nextQuestionData.is_last_question);
      setSectionSummary(nextQuestionData.section_summary || null);
      questionStartTimeRef.current = Date.now();

      trackEvent("questionnaire_step_view", {
        section_index: nextQuestionData.section_index,
        question_index: nextQuestionData.question_index,
        question_id: nextQuestionData.question?.id ?? "",
      });
    }
  }, [nextQuestionData, trackEvent]);

  // Load existing answer from backend progress (no local storage)
  useEffect(() => {
    if (currentQuestion && progress?.answers) {
      const existingAnswer = progress.answers[currentQuestion.id];
      if (existingAnswer !== undefined) {
        setCurrentAnswer(existingAnswer);
      } else {
        setCurrentAnswer(null);
      }
    }
  }, [currentQuestion, progress]);

  // Save answer mutation — update progress cache so bar updates (answers count drives progress)
  const saveAnswerMutation = useMutation({
    mutationFn: saveAnswer,
    onSuccess: (updatedProgress: QuestionnaireProgress) => {
      queryClient.setQueryData(["questionnaire-progress"], updatedProgress);
    },
  });

  // Complete questionnaire mutation — redirect with window.location so it always works
  const completeMutation = useMutation({
    mutationFn: completeQuestionnaire,
    onSuccess: (data) => {
      setCompletionRewards(data.rewards);
      setShowCompletionModal(false);
      queryClient.invalidateQueries({ queryKey: ["questionnaire-progress"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      window.location.href = "/subscriptions";
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Failed to complete onboarding");
    },
  });

  // Abandon questionnaire mutation
  const abandonMutation = useMutation({
    mutationFn: abandonQuestionnaire,
    onSuccess: () => {
      navigate("/all-topics");
      toast.success("Progress saved. You can resume anytime!");
    },
  });

  const handleAnswerChange = useCallback((value: unknown) => {
    setCurrentAnswer(value);
  }, []);

  const handleSaveAndFinishLater = useCallback(async () => {
    if (currentQuestion && currentAnswer !== null) {
      const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000;
      const qId = currentQuestion.id ?? `s${sectionIndex}_q${questionIndex}`;
      await saveAnswerMutation.mutateAsync({
        question_id: qId,
        answer: currentAnswer,
        section_index: sectionIndex,
        question_index: questionIndex,
        time_spent_seconds: timeSpent,
      });
    }
    await abandonMutation.mutateAsync();
  }, [currentQuestion, currentAnswer, sectionIndex, questionIndex, saveAnswerMutation, abandonMutation]);

  const handleNext = useCallback(async () => {
    if (!currentQuestion || currentAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000;
    const qId = currentQuestion.id ?? `s${sectionIndex}_q${questionIndex}`;

    try {
      await saveAnswerMutation.mutateAsync({
        question_id: qId,
        answer: currentAnswer,
        section_index: sectionIndex,
        question_index: questionIndex,
        time_spent_seconds: timeSpent,
      });

      trackEvent("questionnaire_answer_submitted", {
        question_id: qId,
        section_index: sectionIndex,
        question_index: questionIndex,
        time_spent_seconds: timeSpent,
      });

      queryClient.invalidateQueries({ queryKey: ["questionnaire-next-question"] });
      await refetchNextQuestion();
      setCurrentAnswer(null);
    } catch (error) {
      console.error("Failed to save answer:", error);
      toast.error("Failed to save. Please try again.");
    }
  }, [
    currentQuestion,
    currentAnswer,
    sectionIndex,
    questionIndex,
    saveAnswerMutation,
    refetchNextQuestion,
    queryClient,
    trackEvent,
  ]);

  const handleComplete = useCallback(async () => {
    if (!currentQuestion || currentAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000;
    const qId = currentQuestion.id ?? `s${sectionIndex}_q${questionIndex}`;

    try {
      await saveAnswerMutation.mutateAsync({
        question_id: qId,
        answer: currentAnswer,
        section_index: sectionIndex,
        question_index: questionIndex,
        time_spent_seconds: timeSpent,
      });
      try {
        await completeMutation.mutateAsync(undefined);
      } catch {
        toast.error("Could not complete. Taking you to plans…");
      }
      window.location.href = "/subscriptions";
    } catch (error) {
      console.error("Failed to save answer:", error);
      toast.error("Failed to save. Please try again.");
    }
  }, [
    currentQuestion,
    currentAnswer,
    sectionIndex,
    questionIndex,
    saveAnswerMutation,
    completeMutation,
  ]);

  /** Stable question id (backend structure may omit id for some questions). */
  const questionId =
    currentQuestion?.id ?? `s${sectionIndex}_q${questionIndex}`;

  /** For multiple_choice: save selected value to backend and go to next question (or complete). */
  const handleOptionSelect = useCallback(
    async (value: unknown) => {
      if (!currentQuestion) return;
      if (saveAnswerMutation.isPending || completeMutation.isPending) return;

      setCurrentAnswer(value);
      const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000;

      try {
        await saveAnswerMutation.mutateAsync({
          question_id: questionId,
          answer: value,
          section_index: sectionIndex,
          question_index: questionIndex,
          time_spent_seconds: timeSpent,
        });

        trackEvent("questionnaire_answer_submitted", {
          question_id: currentQuestion.id,
          section_index: sectionIndex,
          question_index: questionIndex,
          time_spent_seconds: timeSpent,
        });

        if (computedIsLastQuestion) {
          try {
            await completeMutation.mutateAsync(undefined);
          } catch {
            toast.error("Could not complete. Taking you to plans…");
          }
          window.location.href = "/subscriptions";
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["questionnaire-next-question"] });
        await refetchNextQuestion();
        setCurrentAnswer(null);
      } catch (error) {
        console.error("Failed to save answer", error);
        toast.error("Failed to save. Please try again.");
      }
    },
    [
      currentQuestion,
      questionId,
      sectionIndex,
      questionIndex,
      computedIsLastQuestion,
      saveAnswerMutation,
      completeMutation,
      refetchNextQuestion,
      queryClient,
      trackEvent,
    ]
  );

  const renderQuestionInput = (question: QuestionnaireQuestion) => {
    switch (question.type) {
      case "multiple_choice": {
        const options = question.options || [];
        const isSaving =
          saveAnswerMutation.isPending || completeMutation.isPending;
        return (
          <div className="relative z-10 grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const isSelected = currentAnswer === option.value;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleOptionSelect(option.value)}
                  disabled={isSaving}
                  className={`cursor-pointer rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40 touch-manipulation disabled:cursor-not-allowed disabled:opacity-70 ${
                    isSelected
                      ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
                  }`}
                  aria-pressed={isSelected}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );
      }

      case "multiple_select": {
        // One tap = pick this option and advance (same as multiple_choice; save as [value])
        const options = question.options || [];
        const isSaving =
          saveAnswerMutation.isPending || completeMutation.isPending;
        return (
          <div className="relative z-10 grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const isSelected = currentAnswer === option.value ||
                (Array.isArray(currentAnswer) && currentAnswer.includes(option.value));
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleOptionSelect([option.value])}
                  disabled={isSaving}
                  className={`cursor-pointer rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40 touch-manipulation disabled:cursor-not-allowed disabled:opacity-70 ${
                    isSelected
                      ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
                  }`}
                  aria-pressed={isSelected}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );
      }

      default:
        return (
          <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Unsupported question type: {question.type}
          </div>
        );
    }
  };

  if (isLoadingProgress) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <Loader message="Loading onboarding..." />
      </div>
    );
  }

  if (isProgressError) {
    const message =
      (progressError as { response?: { status?: number } })?.response?.status === 503
        ? "Onboarding is being set up. Please try again in a moment."
        : "We couldn't load onboarding. Please try again.";
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard padding="lg" className="max-w-md text-center">
          <h2 className="mb-4 text-xl font-semibold text-[color:var(--accent,#111827)]">
            Something went wrong
          </h2>
          <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">{message}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <GlassButton onClick={() => refetchProgress()} variant="primary">
              Try again
            </GlassButton>
            <GlassButton onClick={() => navigate("/all-topics")} variant="ghost">
              Go to Dashboard
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (progress?.status === "completed") {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard padding="lg" className="max-w-md text-center">
          <h2 className="mb-4 text-xl font-semibold text-[color:var(--accent,#111827)]">
            Onboarding Complete!
          </h2>
          <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">
            You're ready to choose a plan and unlock your personalized path.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <GlassButton onClick={() => navigate("/subscriptions")} variant="primary">
              View Plans
            </GlassButton>
            <GlassButton onClick={() => navigate("/all-topics")} variant="ghost">
              Go to All Topics
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (isProgressActive && isNextQuestionError) {
    const message =
      (nextQuestionError as { response?: { status?: number } })?.response?.status === 503
        ? "Questionnaire is being set up. Please try again in a moment."
        : "We couldn't load the next question. Please try again.";
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard padding="lg" className="max-w-md text-center">
          <h2 className="mb-4 text-xl font-semibold text-[color:var(--accent,#111827)]">
            Something went wrong
          </h2>
          <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">{message}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <GlassButton onClick={() => refetchNextQuestion()} variant="primary">
              Try again
            </GlassButton>
            <GlassButton onClick={() => navigate("/all-topics")} variant="ghost">
              Go to Dashboard
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  // No question yet: show retry if query finished but we have no question; otherwise show loading only while fetching
  if (isProgressActive && !currentQuestion) {
    if (!isLoadingQuestion) {
      return (
        <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
          <GlassCard padding="lg" className="max-w-md text-center">
            <h2 className="mb-4 text-xl font-semibold text-[color:var(--accent,#111827)]">
              No question loaded
            </h2>
            <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">
              We couldn&apos;t load the next question. Please try again.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <GlassButton onClick={() => refetchNextQuestion()} variant="primary">
                Try again
              </GlassButton>
              <GlassButton onClick={() => navigate("/all-topics")} variant="ghost">
                Go to Dashboard
              </GlassButton>
            </div>
        </GlassCard>
      </div>
    );
    }
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <Loader message="Loading question..." />
      </div>
    );
  }

  return (
    <>
      <section
        className="min-h-screen bg-gradient-to-br from-[color:var(--bg-color,#f8fafc)] via-[color:var(--bg-color,#f8fafc)] to-[color:var(--primary,#2563eb)]/5 px-4 py-10"
        aria-label="Onboarding Questionnaire"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          {/* Header */}
          <header className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                Question {currentQuestionNumberDisplay} of {totalQuestionsDisplay}
              </p>
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/all-topics")}
                  aria-label="Go to All Topics"
                >
                  All Topics
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveAndFinishLater}
                  disabled={abandonMutation.isPending}
                >
                  Save and Finish Later
                </GlassButton>
              </div>
            </div>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Tell us about yourself
          </h1>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Answer a few quick questions so we can tailor your learning experience.
            </p>
          </header>

          {/* Progress Stepper */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              <span>Progress</span>
              <span>{computedProgressPercentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/80 transition-[width] duration-500 ease-out"
                style={{ width: `${computedProgressPercentage}%` }}
                role="progressbar"
                aria-valuenow={computedProgressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          {/* Section Summary Card (if available) */}
          {sectionSummary && (
            <GlassCard padding="md" className="border-[color:var(--primary,#2563eb)]/20 bg-[color:var(--primary,#2563eb)]/5">
              <h3 className="mb-3 text-sm font-semibold text-[color:var(--accent,#111827)]">
                {sectionSummary.section_title} Summary
              </h3>
              <div className="space-y-2">
                {sectionSummary.answers.map((item, idx) => (
                  <div key={idx} className="text-xs text-[color:var(--muted-text,#6b7280)]">
                    <span className="font-medium">{item.question}:</span> {item.answer}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Question Card */}
          <GlassCard padding="lg" className="relative z-10 space-y-6 md:px-10">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-[color:var(--accent,#111827)]">
                {currentQuestion.text}
              </h2>
              {currentQuestion.description && (
                <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                  {currentQuestion.description}
                </p>
              )}
            </div>

            {renderQuestionInput(currentQuestion)}

            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <GlassButton
                variant="ghost"
                onClick={() => {
                  // Go back to previous question (would need backend support)
                  toast("Previous question navigation coming soon");
                }}
                disabled
              >
                ← Previous
              </GlassButton>

              <div className="flex gap-3">
                {!computedIsLastQuestion ? (
                  <GlassButton
                    variant="primary"
                    onClick={handleNext}
                    disabled={currentAnswer === null || saveAnswerMutation.isPending}
                  >
                    {saveAnswerMutation.isPending ? "Saving..." : "Next →"}
                  </GlassButton>
                ) : (
                  <GlassButton
                    variant="primary"
                    onClick={handleComplete}
                    disabled={currentAnswer === null || completeMutation.isPending}
                  >
                    {completeMutation.isPending ? "Completing..." : "Complete"}
                  </GlassButton>
                )}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Completion Modal */}
      {showCompletionModal && completionRewards && (
        <QuestionnaireCompletionModal
          isOpen={showCompletionModal}
          rewards={completionRewards}
          onClose={() => {
            setShowCompletionModal(false);
            navigate("/subscriptions");
          }}
          onStartLearning={() => {
            setShowCompletionModal(false);
            navigate("/subscriptions");
          }}
        />
      )}
    </>
  );
};

export default OnboardingQuestionnaire;
