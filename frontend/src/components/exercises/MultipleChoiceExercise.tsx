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
  } = data || {};
  const { t } = useTranslation();
  const { settings } = useAuth();
  const soundEnabled = settings?.sound_enabled ?? true;
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(null);

  useEffect(() => {
    setSelectedAnswer(null);
    setFeedback("");
    setFeedbackType(null);
  }, [exerciseId, isCompleted]);

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
    }
  };

  const handleRetry = async () => {
    try {
      if (!exerciseId) return;
      await apiClient.post("/exercises/reset/", { section_id: exerciseId });
      setSelectedAnswer(null);
      setFeedback("");
      setFeedbackType(null);
    } catch (error) {
      console.error("Error resetting exercise:", error);
    }
  };

  return (
    <GlassCard padding="lg" className="transition">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
          {question}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
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
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 ${
                isSelected
                  ? "border-[color:var(--accent,#ffd700)] bg-[color:var(--accent,#ffd700)]/10 text-[color:var(--accent,#ffd700)] shadow-inner"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#ffd700)]/40"
              } ${
                feedbackType && isSelected
                  ? feedbackType === "success"
                    ? "border-[color:var(--accent,#ffd700)]/45 bg-[color:var(--accent,#ffd700)]/12 text-[color:var(--accent,#ffd700)]"
                    : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                  : ""
              } ${isCompleted || disabled ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <span>{option}</span>
              {isSelected && (
                <span className="text-xs uppercase tracking-wide text-[color:var(--accent,#ffd700)]">
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
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#ffd700)] px-5 py-2 text-sm font-semibold text-[color:var(--accent,#ffd700)] transition hover:bg-[color:var(--accent,#ffd700)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
          >
            {t("exercises.actions.retryExercise")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedAnswer === null || disabled}
            className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 ${
              selectedAnswer === null || disabled
                ? "cursor-not-allowed bg-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)]"
                : "bg-[color:var(--primary,#1d5330)] text-white shadow-lg shadow-[color:var(--accent,#ffd700)]/30 hover:shadow-xl hover:shadow-[color:var(--accent,#ffd700)]/40"
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
              ? "border-[color:var(--accent,#ffd700)]/35 bg-[color:var(--accent,#ffd700)]/10 text-[color:var(--accent,#ffd700)]"
              : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
          }`}
          aria-live="polite"
        >
          {feedback}
          {feedbackType === "error" && explanation && (
            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              {explanation}
            </p>
          )}
          {feedbackType === "error" && learn_more_url && (
            <div className="mt-2">
              <a
                href={learn_more_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[color:var(--accent,#ffd700)] underline"
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
