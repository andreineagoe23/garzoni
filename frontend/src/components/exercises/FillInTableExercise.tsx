import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { playFeedbackChime } from "utils/sound";

type TableRow = {
  id: string | number;
  label?: string;
  cells?: string[];
};

type TableData = {
  columns?: string[];
  rows?: TableRow[];
};

type FillInTableExerciseProps = {
  data?: {
    question?: string;
    table?: TableData;
    correctAnswer?: Record<string | number, string[]>;
    learn_more_url?: string;
    explanation?: string;
  };
  exerciseId?: string | number;
  onComplete?: () => Promise<void> | void;
  onAttempt?: (payload: { correct: boolean }) => void;
  isCompleted?: boolean;
  disabled?: boolean;
};

const FillInTableExercise = ({
  data,
  exerciseId,
  onComplete,
  onAttempt,
  isCompleted,
  disabled = false,
}: FillInTableExerciseProps) => {
  const { getAccessToken, settings } = useAuth();
  const soundEnabled = settings?.sound_enabled ?? true;
  const { t } = useTranslation();
  const { question, table, correctAnswer, learn_more_url, explanation } =
    data || {};
  const columns = table?.columns || [];
  const rows = table?.rows || [];

  const emptyAnswers = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.id] = Array.from({ length: columns.length }).map(() => "");
        return acc;
      },
      {} as Record<string | number, string[]>
    );
  }, [rows, columns.length]);

  const [answers, setAnswers] =
    useState<Record<string | number, string[]>>(emptyAnswers);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null
  );

  useEffect(() => {
    setAnswers(emptyAnswers);
    setFeedback("");
    setFeedbackType(null);
  }, [emptyAnswers, isCompleted]);

  const handleChange = (
    rowId: string | number,
    colIndex: number,
    value: string
  ) => {
    if (disabled) return;
    setAnswers((prev) => {
      const next = { ...prev };
      const rowValues = [...(next[rowId] || [])];
      rowValues[colIndex] = value;
      next[rowId] = rowValues;
      return next;
    });
  };

  const isCellCorrect = (
    rowId: string | number,
    colIndex: number,
    value: string
  ) => {
    if (!correctAnswer) return null;
    const expectedRow = correctAnswer[rowId];
    if (!expectedRow) return null;
    return (
      String(expectedRow[colIndex] ?? "")
        .trim()
        .toLowerCase() ===
      String(value ?? "")
        .trim()
        .toLowerCase()
    );
  };

  const handleSubmit = async () => {
    if (disabled) return;
    const hasInput = Object.values(answers).some((row) =>
      row.some((cell) => cell && String(cell).trim().length > 0)
    );
    if (!hasInput) {
      setFeedback(t("exercises.table.fillOne"));
      setFeedbackType("error");
      return;
    }

    const isCorrect =
      correctAnswer &&
      Object.entries(correctAnswer).every(([rowId, rowValues]) =>
        rowValues.every(
          (expected, colIndex) =>
            String(expected ?? "")
              .trim()
              .toLowerCase() ===
            String(answers[rowId]?.[colIndex] ?? "")
              .trim()
              .toLowerCase()
        )
      );

    if (isCorrect) {
      setFeedback(t("exercises.table.correct"));
      setFeedbackType("success");
    } else {
      setFeedback(t("exercises.table.incorrect"));
      setFeedbackType("error");
    }

    playFeedbackChime({
      enabled: Boolean(soundEnabled ?? true),
      correct: Boolean(isCorrect),
    });
    onAttempt?.({ correct: Boolean(isCorrect) });

    if (isCorrect) {
      try {
        await onComplete?.();
      } catch (error) {
        setFeedback(t("exercises.saveError"));
        setFeedbackType("error");
      }
    }
  };

  const handleRetry = async () => {
    try {
      const sectionId = exerciseId;
      if (!sectionId) return;
      await apiClient.post("/exercises/reset/", { section_id: sectionId });
      setAnswers(emptyAnswers);
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
          {t("exercises.table.instruction")}
        </p>
      </header>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                {t("exercises.table.row")}
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  className="text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 font-semibold text-[color:var(--accent,#111827)]">
                  {row.label || t("exercises.table.rowWithId", { id: row.id })}
                </td>
                {columns.map((column, colIndex) => {
                  const value = answers[row.id]?.[colIndex] ?? "";
                  const correctness =
                    feedbackType && isCellCorrect(row.id, colIndex, value);
                  const borderClass =
                    feedbackType && correctness !== null
                      ? correctness
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)]";
                  return (
                    <td key={`${row.id}-${column}`}>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          handleChange(row.id, colIndex, event.target.value)
                        }
                        disabled={isCompleted || disabled}
                        aria-label={`${row.label || t("exercises.table.row")} ${column}`}
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30 disabled:cursor-not-allowed disabled:opacity-60 ${borderClass}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {isCompleted ? (
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#2563eb)] px-5 py-2 text-sm font-semibold text-[color:var(--accent,#2563eb)] transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            {t("exercises.actions.retryExercise")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            {t("exercises.table.submitTable")}
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
                {t("exercises.explanation.learnMoreLink")}
              </a>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default FillInTableExercise;
