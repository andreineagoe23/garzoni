import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "services/backendUrl";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { playFeedbackChime } from "utils/sound";

type ScenarioChoice = {
  id: string | number;
  label: string;
  outcome?: string;
};

type ScenarioSimulationExerciseProps = {
  data?: {
    question?: string;
    scenario?: string;
    choices?: ScenarioChoice[];
    correctAnswer?: string | number;
    learn_more_url?: string;
    explanation?: string;
  };
  exerciseId?: string | number;
  onComplete?: () => Promise<void> | void;
  onAttempt?: (payload: { correct: boolean }) => void;
  isCompleted?: boolean;
  disabled?: boolean;
};

const ScenarioSimulationExercise = ({
  data,
  exerciseId,
  onComplete,
  onAttempt,
  isCompleted,
  disabled = false,
}: ScenarioSimulationExerciseProps) => {
  const { getAccessToken, settings } = useAuth();
  const soundEnabled = settings?.sound_enabled ?? true;
  const { question, scenario, choices = [], correctAnswer, learn_more_url, explanation } =
    data || {};
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null
  );

  useEffect(() => {
    setSelectedId(null);
    setFeedback("");
    setFeedbackType(null);
  }, [exerciseId, isCompleted]);

  const selectedChoice = useMemo(
    () => choices.find((choice) => choice.id === selectedId),
    [choices, selectedId]
  );

  const handleSubmit = async () => {
    if (disabled) return;
    if (selectedId === null || selectedId === undefined) return;

    const isCorrect = selectedId === correctAnswer;
    setFeedbackType(isCorrect ? "success" : "error");
    setFeedback(
      isCorrect ? "Great call! You handled the scenario well." : "Not quite. Try another strategy."
    );
    playFeedbackChime({ enabled: Boolean(soundEnabled ?? true), correct: isCorrect });
    onAttempt?.({ correct: isCorrect });

    if (isCorrect) {
      try {
        await onComplete?.();
      } catch (error) {
        setFeedback("Error saving progress. Please try again.");
        setFeedbackType("error");
      }
    }
  };

  const handleRetry = async () => {
    try {
      const sectionId = exerciseId;
      if (!sectionId) return;
      await axios.post(
        `${BACKEND_URL}/exercises/reset/`,
        { section_id: sectionId },
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      setSelectedId(null);
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
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">{scenario}</p>
      </header>

      <div className="mt-6 space-y-4">
        <div
          className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const choiceId = event.dataTransfer.getData("text/plain");
            if (!choiceId) return;
            const parsed =
              Number.isNaN(Number(choiceId)) || choiceId.trim() === ""
                ? choiceId
                : Number(choiceId);
            setSelectedId(parsed);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              (event.key === "Enter" || event.key === " ") &&
              selectedId !== null &&
              selectedId !== undefined
            ) {
              event.preventDefault();
              setSelectedId(selectedId);
            }
          }}
        >
          <span className="font-semibold text-[color:var(--accent,#111827)]">
            Action slot:
          </span>{" "}
          {selectedChoice ? selectedChoice.label : "Drag a choice here or select one below."}
        </div>

        <div className="grid gap-3">
          {choices.map((choice) => {
            const isSelected = choice.id === selectedId;
            const borderClass =
              feedbackType && isSelected
                ? feedbackType === "success"
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600"
                  : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]";
            return (
              <button
                key={choice.id}
                type="button"
                draggable={!isCompleted && !disabled}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", String(choice.id));
                }}
                onClick={() => !isCompleted && !disabled && setSelectedId(choice.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (!isCompleted && !disabled) {
                      setSelectedId(choice.id);
                    }
                  }
                }}
                disabled={isCompleted || disabled}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${borderClass} ${
                  isCompleted || disabled ? "cursor-not-allowed opacity-70" : ""
                }`}
              >
                <span>{choice.label}</span>
                {isSelected && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#2563eb)]">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
            disabled={selectedId === null || selectedId === undefined || disabled}
            className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
              selectedId === null || selectedId === undefined || disabled
                ? "cursor-not-allowed bg-[color:var(--border-color,#d1d5db)] text-[color:var(--muted-text,#6b7280)]"
                : "bg-[color:var(--primary,#2563eb)] text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40"
            }`}
          >
            Submit Choice
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
          {selectedChoice?.outcome && (
            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              {selectedChoice.outcome}
            </p>
          )}
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
                className="text-xs font-semibold text-[color:var(--accent,#2563eb)] underline"
              >
                Learn more
              </a>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default ScenarioSimulationExercise;
