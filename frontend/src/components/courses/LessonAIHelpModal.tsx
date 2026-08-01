import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  explainExercise,
  requestAiTutorHint,
  type ExplainResult,
} from "@garzoni/core";
import { GlassButton } from "components/ui";

export type LessonAIHelpContext = {
  question: string | null;
  exerciseType?: string;
  correctAnswer?: unknown;
  skill?: string | null;
  exerciseId?: number | string | null;
};

type Props = {
  open: boolean;
  context: LessonAIHelpContext | null;
  /** Fires when the learner dismisses the modal — the caller resumes the deferred heart decrement here. */
  onDismiss: () => void;
};

type ResultMode = "explain" | "hint" | "generic";

/**
 * In-context "rescue" modal shown on the 2nd consecutive wrong answer for an
 * exercise (web counterpart of mobile's LessonAIHelpSheet). Tries a real AI
 * explanation first; on quota exhaustion (or any failure) it falls back to
 * the static progressive-hint endpoint, then a generic client-side hint.
 * Never shows an upsell/paywall — this is a mid-lesson helper.
 */
export default function LessonAIHelpModal({ open, context, onDismiss }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ResultMode | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(
    null
  );
  const [hintText, setHintText] = useState<string | null>(null);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      fetchedKeyRef.current = null;
      return;
    }
    if (!context?.question) {
      setLoading(false);
      setMode("generic");
      return;
    }

    const key = `${context.exerciseId ?? ""}:${context.question}`;
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;

    let cancelled = false;
    setLoading(true);
    setMode(null);
    setExplainResult(null);
    setHintText(null);

    const fallbackToHint = async () => {
      if (context.exerciseId != null) {
        try {
          const hint = await requestAiTutorHint(context.exerciseId, 2);
          if (hint && !cancelled) {
            setHintText(hint);
            setMode("hint");
            return;
          }
        } catch {
          // fall through to generic
        }
      }
      if (!cancelled) setMode("generic");
    };

    void (async () => {
      try {
        const result = await explainExercise({
          exerciseQuestion: context.question as string,
          exerciseType: context.exerciseType,
          correctAnswer: context.correctAnswer,
          userAnswer: "",
          skill: context.skill,
          exerciseId: context.exerciseId,
        });
        if (cancelled) return;
        if (result?.explanation) {
          setExplainResult(result);
          setMode("explain");
        } else {
          await fallbackToHint();
        }
      } catch (err) {
        void err;
        if (!cancelled) await fallbackToHint();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, context]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-help-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] p-6 pt-12 shadow-2xl dark:bg-[color:var(--color-surface-card)]">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border-default)] text-xl font-light leading-none text-content-muted transition hover:border-[color:#2a7347]/50 hover:bg-[color:#2a7347]/10 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/40"
          aria-label={t("courses.flow.aiHelpDismissAria")}
        >
          ×
        </button>
        <h2
          id="ai-help-title"
          className="mt-2 text-center text-2xl font-bold text-content-primary"
        >
          {t("courses.flow.aiHelpTitle")}
        </h2>
        <p className="mt-1 text-center text-sm text-content-muted">
          {t("courses.flow.aiHelpSubtitle")}
        </p>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-content-muted">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t("exercises.explanation.loading", "Garzoni is explaining...")}
          </div>
        )}

        {!loading && mode === "explain" && explainResult && (
          <div className="mt-6 rounded-2xl border border-[color:#2a7347]/25 bg-[color:#2a7347]/8 px-4 py-3.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:#2a7347]/70">
              {t("exercises.explanation.title", "Garzoni explains")}
            </p>
            <p className="text-sm leading-relaxed text-content-primary">
              {explainResult.explanation}
            </p>
            {explainResult.practice_question && (
              <div className="mt-3 rounded-xl border border-[color:#1d5330]/25 bg-surface-elevated px-3.5 py-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:#2a7347]/70">
                  {t("exercises.explanation.tryThis", "Try a similar question")}
                </p>
                <p className="text-xs font-medium text-content-primary">
                  {explainResult.practice_question.question}
                </p>
                {Array.isArray(explainResult.practice_question.choices) && (
                  <ul className="mt-2 space-y-1">
                    {explainResult.practice_question.choices.map(
                      (choice: string, i: number) => (
                        <li key={i} className="text-xs text-content-muted">
                          {String.fromCharCode(65 + i)}. {choice}
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && mode === "hint" && hintText && (
          <div className="mt-6 rounded-2xl border border-[color:#2a7347]/25 bg-[color:#2a7347]/8 px-4 py-3.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:#2a7347]/70">
              {t("courses.flow.aiHelpHintLabel")}
            </p>
            <p className="text-sm leading-relaxed text-content-primary">
              {hintText}
            </p>
          </div>
        )}

        {!loading && mode === "generic" && (
          <div className="mt-6 rounded-2xl border border-[color:#2a7347]/25 bg-[color:#2a7347]/8 px-4 py-3.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[color:#2a7347]/70">
              {t("courses.flow.aiHelpHintLabel")}
            </p>
            <p className="text-sm leading-relaxed text-content-primary">
              {t("courses.flow.aiHelpGenericHint")}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <GlassButton type="button" variant="active" onClick={onDismiss}>
            {t("courses.flow.aiHelpContinue")}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
