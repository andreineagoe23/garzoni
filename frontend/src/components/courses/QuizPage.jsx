import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import PageContainer from "components/common/PageContainer";
import { GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";

function QuizPage() {
  const { courseId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [earnedMoney, setEarnedMoney] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${BACKEND_URL}/quizzes/?course=${courseId}`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        const quizData = response.data?.[0];
        if (quizData) {
          setQuiz({
            id: quizData.id,
            title: quizData.title,
            question: quizData.question,
            choices: quizData.choices,
            correct_answer: quizData.correct_answer,
          });
          setError("");
        } else {
          setError("No quiz data available for this course.");
        }
      } catch (err) {
        console.error("Failed to fetch quiz:", err);
        setError("Failed to load quiz. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [courseId, getAccessToken]);

  const handleSubmit = async () => {
    if (!quiz) return;

    if (selectedAnswer === null) {
      setFeedback("Please select an answer before submitting.");
      return;
    }

    try {
      const response = await axios.post(
        `${BACKEND_URL}/quizzes/complete/`,
        { quiz_id: quiz.id, selected_answer: selectedAnswer },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      setFeedback(response.data.message);
      setEarnedMoney(response.data.earned_money || 0);

      // If answer is incorrect, don't treat it as an error
      if (!response.data.correct) {
        // User can try again
        setSelectedAnswer(null);
      }
    } catch (err) {
      console.error("Error submitting answer:", err);
      setFeedback(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="4xl" layout="centered">
        <div className="flex items-center gap-3 text-[color:var(--muted-text,#6b7280)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          Loading quiz...
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="4xl">
        <GlassCard padding="md" className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10">
          {error}
        </GlassCard>
      </PageContainer>
    );
  }

  if (!quiz) {
    return (
      <PageContainer maxWidth="4xl">
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-4 text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
          No quiz data available.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="4xl">
      <header className="space-y-3 text-center">
        <h2 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Quiz: {quiz.title}
        </h2>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Answer correctly to earn rewards and boost your progress.
        </p>
      </header>

      <GlassCard padding="lg" className="space-y-6">
        <p className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {quiz.question}
        </p>

        <div className="space-y-3">
          {quiz.choices.map((choice, index) => (
            <label
              key={choice.text}
              htmlFor={`choice-${index}`}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-[color:var(--accent,#2563eb)]/40 ${
                selectedAnswer === choice.text
                  ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] text-[color:var(--text-color,#111827)]"
              }`}
            >
              <input
                type="radio"
                id={`choice-${index}`}
                name="quiz"
                value={choice.text}
                checked={selectedAnswer === choice.text}
                onChange={(event) => setSelectedAnswer(event.target.value)}
                className="h-4 w-4 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]"
              />
              {choice.text}
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
        >
          Submit Answer
        </button>

        {feedback && (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm shadow-inner ${
              earnedMoney > 0
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                : feedback.includes("Incorrect")
                ? "border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
            }`}
          >
            <p>{feedback}</p>
            {earnedMoney > 0 && (
              <p className="mt-1 font-semibold">
                You earned £{earnedMoney.toFixed(2)}!
              </p>
            )}
          </div>
        )}
      </GlassCard>
    </PageContainer>
  );
}

export default QuizPage;
