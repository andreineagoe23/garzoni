import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const MultipleChoiceExercise = ({
  data,
  exerciseId,
  onComplete,
  isCompleted,
}) => {
  const { question, options = [], correctAnswer } = data || {};
  const { getAccessToken } = useAuth();
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(null);

  useEffect(() => {
    setSelectedAnswer(null);
    setFeedback("");
    setFeedbackType(null);
  }, [exerciseId, isCompleted]);

  const handleSubmit = async () => {
    if (selectedAnswer === null) return;

    if (selectedAnswer === correctAnswer) {
      setFeedback("Correct! Well done!");
      setFeedbackType("success");
      try {
        await onComplete();
      } catch (error) {
        setFeedback("Error saving progress. Please try again.");
        setFeedbackType("error");
      }
    } else {
      setFeedback("Incorrect. Try again!");
      setFeedbackType("error");
    }
  };

  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: exerciseId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
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
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {question}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Choose the best answer from the options below.
        </p>
      </header>

      <div className="mt-6 grid gap-3">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => !isCompleted && setSelectedAnswer(index)}
              disabled={isCompleted}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
                isSelected
                  ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)] shadow-inner"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
              } ${isCompleted ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <span>{option}</span>
              {isSelected && (
                <span className="text-xs uppercase tracking-wide text-[color:var(--accent,#2563eb)]">
                  Selected
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
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#2563eb)] px-5 py-2 text-sm font-semibold text-[color:var(--accent,#2563eb)] transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            Retry Exercise
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedAnswer === null}
            className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
              selectedAnswer === null
                ? "cursor-not-allowed bg-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)]"
                : "bg-[color:var(--primary,#2563eb)] text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40"
            }`}
          >
            Submit Answer
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedbackType === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
          }`}
        >
          {feedback}
        </div>
      )}
    </GlassCard>
  );
};

export default MultipleChoiceExercise;
