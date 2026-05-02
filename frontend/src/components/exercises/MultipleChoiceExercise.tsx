import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { playFeedbackChime } from "utils/sound";

const MultipleChoiceExercise = ({
  data,
  exerciseId,
  onComplete,
  onAttempt,
  isCompleted,
  disabled = false,
}) => {
  const {
    question,
    options = [],
    correctAnswer,
    explanation,
    learn_more_url,
    skill,
  } = data || {};
  const { t } = useTranslation();
  const { settings } = useAuth();
  const soundEnabled = settings?.sound_enabled ?? true;
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [practiceQuestion, setPracticeQuestion] = useState<{
    question: string;
    choices?: string[];
    correct_answer?: string;
  } | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);

  useEffect(() => {
    setSelectedAnswer(null);
    setFeedback("");
    setFeedbackType(null);
    setAiExplanation(null);
    setPracticeQuestion(null);
  }, [exerciseId, isCompleted]);

  const fetchAiExplanation = async (userAnswer: string) => {
    setLoadingExplain(true);
    try {
      const res = await apiClient.post("/exercises/explain/", {
        exercise_question: question,
        exercise_type: "multiple_choice",
        correct_answer: options[correctAnswer] ?? correctAnswer,
        user_answer: userAnswer,
        skill: skill || null,
        exercise_id: exerciseId,
      });
      setAiExplanation(res.data?.explanation || null);
      if (res.data?.practice_question) {
        setPracticeQuestion(res.data.practice_question);
      }
    } catch {
      // Silently fail — static feedback still shown
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleSubmit = async () => {
    if (disabled) return;
    if (selectedAnswer === null) return;

    if (selectedAnswer === correctAnswer) {
      setFeedback(t("exercises.mc.correct"));
      setFeedbackType("success");
      playFeedbackChime({
        enabled: Boolean(soundEnabled ?? true),
        correct: true,
      });
      onAttempt?.({ correct: true });
      try {
        await onComplete?.();
      } catch (error) {
        setFeedback(t("exercises.saveError"));
        setFeedbackType("error");
      }
    } else {
      setFeedback(t("exercises.mc.incorrect"));
      setFeedbackType("error");
      playFeedbackChime({
        enabled: Boolean(soundEnabled ?? true),
        correct: false,
      });
      onAttempt?.({ correct: false });
      // Fetch AI explanation asynchronously — does not block UI
      fetchAiExplanation(options[selectedAnswer] ?? String(selectedAnswer));
    }
  };

  const handleRetry = async () => {
    try {
      if (!exerciseId) return;
      await apiClient.post("/exercises/reset/", { section_id: exerciseId });
      setSelectedAnswer(null);
      setFeedback("");
      setFeedbackType(null);
      setAiExplanation(null);
      setPracticeQuestion(null);
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <GlassCard padding="lg" className="transition">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-content-primary">
          {question}
        </h3>
        <p className="text-sm text-content-muted">
          {t("exercises.mc.chooseBest")}
        </p>
      </header>

      <div className="mt-6 grid gap-3">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() =>
                !isCompleted && !disabled && setSelectedAnswer(index)
              }
              disabled={isCompleted || disabled}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/40 ${
                isSelected
                  ? "border-[color:#2a7347] bg-[color:#2a7347]/10 text-[color:#2a7347] shadow-inner"
                  : "border-[color:var(--border-color,#d1d5db)] bg-surface-page text-content-primary hover:border-[color:#2a7347]/40"
              } ${
                feedbackType && isSelected
                  ? feedbackType === "success"
                    ? "border-[color:#2a7347]/45 bg-[color:#2a7347]/12 text-[color:#2a7347]"
                    : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                  : ""
              } ${isCompleted || disabled ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <span>{option}</span>
              {isSelected && (
                <span className="text-xs uppercase tracking-wide text-[color:#2a7347]">
                  {t("exercises.scenario.selected")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {isCompleted ? (
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center rounded-full border border-[color:#2a7347] px-5 py-2 text-sm font-semibold text-[color:#2a7347] transition hover:bg-[color:#2a7347] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/40"
          >
            {t("exercises.actions.retryExercise")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedAnswer === null || disabled}
            className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/40 ${
              selectedAnswer === null || disabled
                ? "cursor-not-allowed bg-[color:var(--border-color,#d1d5db)] text-content-muted"
                : "bg-[color:var(--primary,#1d5330)] text-white shadow-lg shadow-[color:#2a7347]/30 hover:shadow-xl hover:shadow-[color:#2a7347]/40"
            }`}
          >
            {t("exercises.actions.submit")}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedbackType === "success"
              ? "border-[color:#2a7347]/35 bg-[color:#2a7347]/10 text-[color:#2a7347]"
              : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
          }`}
          aria-live="polite"
        >
          {feedback}
          {feedbackType === "error" && explanation && (
            <p className="mt-2 text-xs text-content-muted">{explanation}</p>
          )}

          {/* AI Explanation block */}
          {feedbackType === "error" && (
            <div className="mt-3 space-y-2">
              {loadingExplain && (
                <div className="flex items-center gap-2 text-xs text-content-muted">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t(
                    "exercises.explanation.loading",
                    "Garzoni is explaining..."
                  )}
                </div>
              )}
              {aiExplanation && (
                <div
                  className="rounded-xl border border-[color:#2a7347]/25 bg-[color:#2a7347]/8 px-3.5 py-3"
                  aria-live="polite"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:#2a7347]/70 mb-1">
                    {t("exercises.explanation.title", "Garzoni explains")}
                  </p>
                  <p className="text-xs leading-relaxed text-content-primary">
                    {aiExplanation}
                  </p>
                </div>
              )}
              {practiceQuestion && (
                <div className="rounded-xl border border-[color:#1d5330]/25 bg-surface-elevated px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:#2a7347]/70 mb-1.5">
                    {t(
                      "exercises.explanation.tryThis",
                      "Try a similar question"
                    )}
                  </p>
                  <p className="text-xs font-medium text-content-primary">
                    {practiceQuestion.question}
                  </p>
                  {Array.isArray(practiceQuestion.choices) && (
                    <ul className="mt-2 space-y-1">
                      {practiceQuestion.choices.map((c: string, i: number) => (
                        <li key={i} className="text-xs text-content-muted">
                          {String.fromCharCode(65 + i)}. {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {feedbackType === "error" && learn_more_url && (
            <div className="mt-2">
              <a
                href={learn_more_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[color:#2a7347] underline"
              >
                {t("exercises.explanation.learnMoreLink")}
              </a>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default MultipleChoiceExercise;
