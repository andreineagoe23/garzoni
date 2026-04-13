import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import apiClient from "services/httpClient";
import { GlassButton } from "components/ui";
import MascotWithMessage from "components/common/MascotWithMessage";
import type { MascotSituation } from "hooks/useMascotMessage";
import { queryKeys } from "lib/reactQuery";

export type CheckpointQuizRow = {
  id: number;
  title: string;
  question: string;
  choices: { text: string }[];
  correct_answer: string;
  is_completed?: boolean;
};

type Props = {
  open: boolean;
  quizzes: CheckpointQuizRow[];
  /** Refreshes lesson progress after checkpoint answers. */
  courseId: number;
  onFinished: () => void;
};

export default function LessonCheckpointQuizModal({
  open,
  quizzes,
  courseId,
  onFinished,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const active = useMemo(() => quizzes[index] ?? null, [quizzes, index]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setSelected(null);
      setFeedback("");
      setCorrect(null);
      setSubmitting(false);
      return;
    }
    setIndex(0);
    setSelected(null);
    setFeedback("");
    setCorrect(null);
    setSubmitting(false);
  }, [open, quizzes]);

  const situation = useMemo((): MascotSituation | undefined => {
    if (correct === true) return "quiz_correct";
    if (correct === false) return "quiz_incorrect";
    return undefined;
  }, [correct]);

  const invalidateRewards = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.progressSummary(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.recentActivity(),
    });
    if (Number.isFinite(courseId) && courseId > 0) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonsWithProgress(courseId),
      });
    }
  }, [courseId, queryClient]);

  const submit = useCallback(async () => {
    if (!active || submitting) return;
    if (selected == null) {
      setCorrect(null);
      setFeedback(t("shared.pleaseSelectAnswer"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiClient.post("/quizzes/complete/", {
        quiz_id: active.id,
        selected_answer: selected,
      });
      const ok = Boolean(response.data?.correct);
      const already = Boolean(response.data?.already_completed);
      setFeedback(String(response.data?.message ?? ""));
      setCorrect(ok || already ? true : false);
      if (ok || already) {
        invalidateRewards();
        const next = index + 1;
        if (next >= quizzes.length) {
          setTimeout(() => onFinished(), 400);
        } else {
          setIndex(next);
          setSelected(null);
          setFeedback("");
          setCorrect(null);
        }
      } else {
        setSelected(null);
      }
    } catch {
      setCorrect(false);
      setFeedback(t("shared.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }, [
    active,
    index,
    invalidateRewards,
    onFinished,
    quizzes.length,
    selected,
    submitting,
    t,
  ]);

  if (!open || !quizzes.length) return null;

  return (
    <div
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkpoint-quiz-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] p-6 pt-12 shadow-2xl dark:bg-[color:var(--card-bg,#0f172a)]">
        <button
          type="button"
          onClick={() => !submitting && onFinished()}
          disabled={submitting}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] text-xl font-light leading-none text-content-muted transition hover:border-[color:var(--accent,#ffd700)]/50 hover:bg-[color:var(--accent,#ffd700)]/10 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 disabled:pointer-events-none disabled:opacity-40"
          aria-label={t("courses.flow.checkpointDismissAria")}
        >
          ×
        </button>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-content-muted">
          {t("courses.flow.checkpointProgress", {
            current: Math.min(index + 1, quizzes.length),
            total: quizzes.length,
          })}
        </p>
        <h2
          id="checkpoint-quiz-title"
          className="mt-2 text-center text-2xl font-bold text-content-primary"
        >
          {t("courses.flow.checkpointTitle")}
        </h2>
        <p className="mt-1 text-center text-sm text-content-muted">
          {t("courses.flow.checkpointSubtitle")}
        </p>

        {active ? (
          <div className="mt-6 space-y-5">
            <h3 className="text-lg font-semibold text-content-primary">
              {active.title}
            </h3>
            <p className="text-base text-content-primary">{active.question}</p>
            <div className="space-y-2">
              {active.choices.map((choice, i) => (
                <label
                  key={`${active.id}-${choice.text}-${i}`}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition ${
                    submitting
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  } ${
                    selected === choice.text
                      ? "border-[color:var(--accent,#ffd700)] bg-[color:var(--accent,#ffd700)]/10"
                      : "border-[color:var(--border-color,#d1d5db)] bg-surface-page/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="checkpoint-quiz"
                    value={choice.text}
                    checked={selected === choice.text}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={submitting}
                    className="h-4 w-4"
                  />
                  {choice.text}
                </label>
              ))}
            </div>

            <div className="flex justify-center pt-2">
              <GlassButton
                type="button"
                variant="active"
                disabled={submitting}
                onClick={() => void submit()}
              >
                {t("courses.quiz.submitAnswer")}
              </GlassButton>
            </div>

            {feedback ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  correct === true
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : correct === false
                      ? "border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-[color:var(--error,#dc2626)]/40 bg-red-500/10 text-red-700"
                }`}
              >
                <MascotWithMessage
                  mood={
                    correct === true
                      ? "celebrate"
                      : correct === false
                        ? "encourage"
                        : "neutral"
                  }
                  situation={situation}
                  customMessage={feedback}
                  rotateMessages={situation != null}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
