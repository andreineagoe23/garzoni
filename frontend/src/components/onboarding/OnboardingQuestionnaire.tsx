import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";
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
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionRewards, setCompletionRewards] = useState<{ xp: number; coins: number } | null>(null);
  const [sectionSummary, setSectionSummary] = useState<NextQuestionResponse["section_summary"] | null>(null);

  // Fetch progress
  const {
    data: progress,
    isLoading: isLoadingProgress,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: ["questionnaire-progress"],
    queryFn: fetchQuestionnaireProgress,
    retry: 1,
  });

  // Fetch next question
  const {
    data: nextQuestionData,
    isLoading: isLoadingQuestion,
    refetch: refetchNextQuestion,
  } = useQuery({
    queryKey: ["questionnaire-next-question"],
    queryFn: fetchNextQuestion,
    enabled: !!progress && progress.status === "in_progress",
    retry: 1,
  });

  // Update state when next question data arrives
  useEffect(() => {
    if (nextQuestionData) {
      setCurrentQuestion(nextQuestionData.question);
      setSectionIndex(nextQuestionData.section_index);
      setQuestionIndex(nextQuestionData.question_index);
      setTotalSections(nextQuestionData.total_sections);
      setProgressPercentage(nextQuestionData.progress_percentage);
      setIsLastQuestion(nextQuestionData.is_last_question);
      setSectionSummary(nextQuestionData.section_summary || null);
      questionStartTimeRef.current = Date.now();

      // Track step view
      trackEvent("questionnaire_step_view", {
        section_index: nextQuestionData.section_index,
        question_index: nextQuestionData.question_index,
        question_id: nextQuestionData.question.id,
      });
    }
  }, [nextQuestionData, trackEvent]);

  // Load existing answer if available
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

  // Save answer mutation
  const saveAnswerMutation = useMutation({
    mutationFn: saveAnswer,
    onSuccess: () => {
      refetchProgress();
    },
  });

  // Complete questionnaire mutation
  const completeMutation = useMutation({
    mutationFn: completeQuestionnaire,
    onSuccess: (data) => {
      setCompletionRewards(data.rewards);
      setShowCompletionModal(true);
      queryClient.invalidateQueries({ queryKey: ["questionnaire-progress"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "Failed to complete questionnaire");
    },
  });

  // Abandon questionnaire mutation
  const abandonMutation = useMutation({
    mutationFn: abandonQuestionnaire,
    onSuccess: () => {
      navigate("/dashboard");
      toast.success("Progress saved. You can resume anytime!");
    },
  });

  const handleAnswerChange = useCallback((value: unknown) => {
    setCurrentAnswer(value);
  }, []);

  const handleSaveAndFinishLater = useCallback(async () => {
    if (currentQuestion && currentAnswer !== null) {
      const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000;
      await saveAnswerMutation.mutateAsync({
        question_id: currentQuestion.id,
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

    try {
      await saveAnswerMutation.mutateAsync({
        question_id: currentQuestion.id,
        answer: currentAnswer,
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

      // Fetch next question
      await refetchNextQuestion();
      setCurrentAnswer(null);
    } catch (error) {
      console.error("Failed to save answer:", error);
    }
  }, [
    currentQuestion,
    currentAnswer,
    sectionIndex,
    questionIndex,
    saveAnswerMutation,
    refetchNextQuestion,
    trackEvent,
  ]);

  const handleComplete = useCallback(async () => {
    if (!currentQuestion || currentAnswer === null) {
      toast.error("Please select an answer");
      return;
    }

    const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000;

    try {
      // Save final answer first
      await saveAnswerMutation.mutateAsync({
        question_id: currentQuestion.id,
        answer: currentAnswer,
        section_index: sectionIndex,
        question_index: questionIndex,
        time_spent_seconds: timeSpent,
      });

      // Then complete
      await completeMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to complete questionnaire:", error);
    }
  }, [
    currentQuestion,
    currentAnswer,
    sectionIndex,
    questionIndex,
    saveAnswerMutation,
    completeMutation,
  ]);

  const renderQuestionInput = (question: QuestionnaireQuestion) => {
    switch (question.type) {
      case "multiple_choice": {
        const options = question.options || [];
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const isSelected = currentAnswer === option.value;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAnswerChange(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40 ${
                    isSelected
                      ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
                  }`}
                  aria-pressed={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        );
      }

      case "multiple_select": {
        const options = question.options || [];
        const selectedValues = Array.isArray(currentAnswer) ? currentAnswer : [];
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    const newValues = isSelected
                      ? selectedValues.filter((v) => v !== option.value)
                      : [...selectedValues, option.value];
                    handleAnswerChange(newValues);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40 ${
                    isSelected
                      ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
                  }`}
                  aria-pressed={isSelected}
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
        <Loader message="Loading questionnaire..." />
      </div>
    );
  }

  if (progress?.status === "completed") {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard padding="lg" className="max-w-md text-center">
          <h2 className="mb-4 text-xl font-semibold text-[color:var(--accent,#111827)]">
            Questionnaire Completed!
          </h2>
          <p className="mb-6 text-sm text-[color:var(--muted-text,#6b7280)]">
            You've already completed the onboarding questionnaire.
          </p>
          <GlassButton onClick={() => navigate("/dashboard")} variant="primary">
            Go to Dashboard
          </GlassButton>
        </GlassCard>
      </div>
    );
  }

  if (isLoadingQuestion || !currentQuestion) {
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                Section {sectionIndex + 1} of {totalSections}
              </p>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleSaveAndFinishLater}
                disabled={abandonMutation.isPending}
              >
                Save and Finish Later
              </GlassButton>
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
              <span>{progressPercentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/80 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
                role="progressbar"
                aria-valuenow={progressPercentage}
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
          <GlassCard padding="lg" className="space-y-6 md:px-10">
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
                  toast.info("Previous question navigation coming soon");
                }}
                disabled
              >
                ← Previous
              </GlassButton>

              <div className="flex gap-3">
                {!isLastQuestion ? (
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
            navigate("/dashboard");
          }}
          onStartLearning={() => {
            setShowCompletionModal(false);
            navigate("/dashboard");
          }}
        />
      )}
    </>
  );
};

export default OnboardingQuestionnaire;

