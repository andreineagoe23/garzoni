import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import apiClient from "services/httpClient";
import { useAuth } from "contexts/AuthContext";
import PageContainer from "components/common/PageContainer";
import MascotWithMessage from "components/common/MascotWithMessage";
import type { MascotSituation } from "hooks/useMascotMessage";
import { GlassCard, GlassButton } from "components/ui";
import { formatCurrency, getLocale } from "utils/format";
import { queryKeys } from "lib/reactQuery";

type QuizChoice = {
  text: string;
};

type QuizRow = {
  id: number;
  title: string;
  question: string;
  choices: QuizChoice[];
  correct_answer: string;
  is_completed?: boolean;
};

type Phase = "intro" | "attempt" | "recap";

function QuizPage() {
  const { t } = useTranslation();
  const { courseId } = useParams();
  const locale = getLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null);
  const [lastEarnedMoney, setLastEarnedMoney] = useState(0);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mascotRotationKey, setMascotRotationKey] = useState(0);
  useAuth();

  const orderedQuizzes = useMemo(
    () => [...quizzes].sort((a, b) => a.id - b.id),
    [quizzes]
  );

  const totalQuizzes = orderedQuizzes.length;

  const activeQuiz = useMemo(() => {
    return orderedQuizzes.find((q) => !q.is_completed) ?? null;
  }, [orderedQuizzes]);

  const completedCount = useMemo(
    () => orderedQuizzes.filter((q) => q.is_completed).length,
    [orderedQuizzes]
  );

  const quizFeedbackSituation = useMemo((): MascotSituation | undefined => {
    if (feedbackCorrect === true) return "quiz_correct";
    if (feedbackCorrect === false) return "quiz_incorrect";
    return undefined;
  }, [feedbackCorrect]);

  const loadQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/quizzes/?course=${courseId ?? ""}`
      );
      const raw = response.data;
      const list: QuizRow[] = Array.isArray(raw)
        ? raw.map((q: Record<string, unknown>) => ({
            id: Number(q.id),
            title: String(q.title ?? ""),
            question: String(q.question ?? ""),
            choices: (q.choices as QuizChoice[]) ?? [],
            correct_answer: String(q.correct_answer ?? ""),
            is_completed: Boolean(q.is_completed),
          }))
        : [];
      list.sort((a, b) => a.id - b.id);
      setQuizzes(list);
      setError("");
      if (list.length === 0) {
        setError(t("courses.quiz.noData"));
      } else if (list.every((q) => q.is_completed)) {
        setPhase("recap");
      } else {
        setPhase("intro");
      }
    } catch (err) {
      console.error("Failed to fetch quiz:", err);
      setError(t("courses.quiz.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    setSelectedAnswer(null);
    setLastEarnedMoney(0);
    setLastEarnedPoints(0);
  }, [activeQuiz?.id]);

  const invalidateRewards = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.progressSummary(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.recentActivity(),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
  }, [queryClient]);

  const handleSubmit = async () => {
    if (!activeQuiz) return;

    if (selectedAnswer === null) {
      setFeedbackCorrect(null);
      setFeedback(t("shared.pleaseSelectAnswer"));
      return;
    }

    try {
      const response = await apiClient.post("/quizzes/complete/", {
        quiz_id: activeQuiz.id,
        selected_answer: selectedAnswer,
      });

      setFeedback(response.data.message ?? "");
      setFeedbackCorrect(response.data.correct ?? false);
      setMascotRotationKey((n) => n + 1);

      if (response.data.correct) {
        invalidateRewards();
        const money = Number(response.data.earned_money ?? 0);
        const pts = Number(response.data.earned_points ?? 0);
        setLastEarnedMoney(money);
        setLastEarnedPoints(pts);
        if (response.data.already_completed) {
          setQuizzes((prev) =>
            prev.map((q) =>
              q.id === activeQuiz.id ? { ...q, is_completed: true } : q
            )
          );
        } else {
          setSessionXp((x) => x + pts);
          setSessionCoins((c) => c + money);
          setQuizzes((prev) =>
            prev.map((q) =>
              q.id === activeQuiz.id ? { ...q, is_completed: true } : q
            )
          );
        }
        if (!response.data.already_completed) {
          setSelectedAnswer(null);
        }
      } else {
        setSelectedAnswer(null);
      }
    } catch (err) {
      console.error("Error submitting answer:", err);
      setFeedbackCorrect(false);
      setMascotRotationKey((n) => n + 1);
      if (axios.isAxiosError(err)) {
        setFeedback(
          (err.response?.data as { message?: string })?.message ??
            t("shared.somethingWentWrong")
        );
      } else {
        setFeedback(t("shared.somethingWentWrong"));
      }
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="4xl" layout="centered">
        <div className="flex items-center gap-3 text-content-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:#2a7347] border-t-transparent" />
          {t("courses.quiz.loading")}
        </div>
      </PageContainer>
    );
  }

  if (error && totalQuizzes === 0) {
    return (
      <PageContainer maxWidth="4xl">
        <GlassCard
          padding="md"
          className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10"
        >
          {error}
        </GlassCard>
      </PageContainer>
    );
  }

  if (totalQuizzes === 0) {
    return (
      <PageContainer maxWidth="4xl">
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-4 text-sm text-content-muted shadow-inner shadow-black/5">
          {t("courses.quiz.noQuizData")}
        </div>
      </PageContainer>
    );
  }

  if (phase === "intro") {
    return (
      <PageContainer maxWidth="4xl">
        <header className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-content-primary">
            {t("courses.quiz.introTitle")}
          </h2>
          <p className="text-sm text-content-muted">
            {t("courses.quiz.introSubtitle", { count: totalQuizzes })}
          </p>
          <p className="text-xs text-content-muted">
            {t("courses.quiz.answerToEarn")}
          </p>
        </header>
        <GlassCard padding="lg" className="mt-8 space-y-6 text-center">
          <GlassButton type="button" onClick={() => setPhase("attempt")}>
            {t("courses.quiz.introStart")}
          </GlassButton>
          <button
            type="button"
            className="text-sm font-semibold text-content-muted underline-offset-2 hover:underline"
            onClick={() => navigate(-1)}
          >
            {t("courses.quiz.backToCourses")}
          </button>
        </GlassCard>
      </PageContainer>
    );
  }

  if (phase === "recap" || !activeQuiz) {
    return (
      <PageContainer maxWidth="4xl">
        <header className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-content-primary">
            {t("courses.quiz.recapTitle")}
          </h2>
          <p className="text-sm text-content-muted">
            {t("courses.quiz.recapSubtitle")}
          </p>
        </header>
        <GlassCard padding="lg" className="mt-8 space-y-4 text-center">
          <p className="text-sm font-semibold text-content-primary">
            {t("courses.quiz.recapXpLine", { points: sessionXp })}
          </p>
          <p className="text-sm text-content-muted">
            {t("courses.quiz.recapCoinsLine", {
              amount: formatCurrency(sessionCoins, "GBP", locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
            })}
          </p>
          <GlassButton type="button" onClick={() => navigate(-1)}>
            {t("courses.quiz.backToCourses")}
          </GlassButton>
        </GlassCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="4xl">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] text-xl font-light leading-none text-content-muted transition hover:border-[color:#2a7347]/50 hover:bg-[color:#2a7347]/10 hover:text-content-primary focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/40"
          aria-label={t("courses.quiz.exitQuizAria")}
        >
          ×
        </button>
      </div>
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
          {t("courses.quiz.progress", {
            current: Math.min(completedCount + 1, totalQuizzes),
            total: totalQuizzes,
          })}
        </p>
        <h2 className="text-2xl font-bold text-content-primary">
          {activeQuiz.title}
        </h2>
        <p className="text-sm text-content-muted">
          {t("courses.quiz.answerToEarn")}
        </p>
      </header>

      <GlassCard padding="lg" className="mt-6 space-y-6">
        <p className="text-lg font-semibold text-content-primary">
          {activeQuiz.question}
        </p>

        <div className="space-y-3">
          {activeQuiz.choices.map((choice, index) => (
            <label
              key={`${activeQuiz.id}-${choice.text}-${index}`}
              htmlFor={`choice-${activeQuiz.id}-${index}`}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-[color:#2a7347]/40 ${
                selectedAnswer === choice.text
                  ? "border-[color:#2a7347] bg-[color:#2a7347]/10 text-[color:#2a7347]"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] text-content-primary"
              }`}
            >
              <input
                type="radio"
                id={`choice-${activeQuiz.id}-${index}`}
                name={`quiz-${activeQuiz.id}`}
                value={choice.text}
                checked={selectedAnswer === choice.text}
                onChange={(event) => setSelectedAnswer(event.target.value)}
                className="h-4 w-4 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:#2a7347]"
              />
              {choice.text}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[color:#2a7347]/30 transition hover:shadow-xl hover:shadow-[color:#2a7347]/40 focus:outline-none focus:ring-2 focus:ring-[color:#2a7347]/40"
          >
            {t("courses.quiz.submitAnswer")}
          </button>
          {feedbackCorrect === true &&
          orderedQuizzes.some((q) => !q.is_completed) ? (
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => {
                setFeedback("");
                setFeedbackCorrect(null);
              }}
            >
              {t("courses.quiz.nextQuiz")}
            </GlassButton>
          ) : null}
          {feedbackCorrect === true &&
          !orderedQuizzes.some((q) => !q.is_completed) ? (
            <GlassButton type="button" onClick={() => setPhase("recap")}>
              {t("courses.quiz.reviewFinish")}
            </GlassButton>
          ) : null}
        </div>

        {feedback ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm shadow-inner ${
              feedbackCorrect === true
                ? "border-[color:#2a7347]/45 bg-[color:#2a7347]/12 text-[color:#2a7347]"
                : feedbackCorrect === false
                  ? "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
            }`}
          >
            <MascotWithMessage
              mood={
                feedbackCorrect === true
                  ? "celebrate"
                  : feedbackCorrect === false
                    ? "encourage"
                    : "neutral"
              }
              situation={quizFeedbackSituation}
              customMessage={feedback}
              rotateMessages={quizFeedbackSituation != null}
              rotationKey={mascotRotationKey}
              className="mt-0"
            />
            {feedbackCorrect === true && lastEarnedMoney > 0 ? (
              <p className="mt-2 text-center font-semibold sm:text-left">
                {t("courses.quiz.youEarned", {
                  amount: formatCurrency(lastEarnedMoney, "GBP", locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                })}
              </p>
            ) : null}
            {feedbackCorrect === true && lastEarnedPoints > 0 ? (
              <p className="mt-1 text-center text-sm font-semibold sm:text-left">
                {t("courses.quiz.youEarnedXp", { points: lastEarnedPoints })}
              </p>
            ) : null}
            {feedbackCorrect === true && lastEarnedPoints === 0 ? (
              <p className="mt-1 text-center text-sm text-content-muted sm:text-left">
                {t("courses.quiz.alreadyCompletedShort")}
              </p>
            ) : null}
          </div>
        ) : null}
      </GlassCard>
    </PageContainer>
  );
}

export default QuizPage;
