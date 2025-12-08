import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const Questionnaire = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitFeedback, setSubmitFeedback] = useState("");
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/enhanced-questionnaire/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        const validatedQuestions = response.data.map((question) => {
          if (Array.isArray(question.options)) {
            return question;
          }

          try {
            const normalized = question.options
              .replace(/'/g, '"')
              .replace(/\\"/g, '"')
              .replace(/^\s*\[(.*)\]\s*$/, "[$1]");
            return {
              ...question,
              options: JSON.parse(normalized),
            };
          } catch (parseError) {
            console.error("Failed to parse options", parseError);
            return { ...question, options: ["Error loading options"] };
          }
        });

        setQuestions(validatedQuestions);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error ||
            "Failed to load questionnaire. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [getAccessToken]);

  const handleAnswer = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBudgetChange = (questionId, category, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [category]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitStatus("submitting");
      setSubmitFeedback("Preparing secure checkout session...");

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/enhanced-questionnaire/`,
        { answers },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      if (response.data.redirect_url) {
        setSubmitStatus("success");
        setSubmitFeedback("Redirecting to secure checkout...");
        window.location.assign(response.data.redirect_url);
      } else {
        setSubmitStatus("success");
        setSubmitFeedback("Questionnaire submitted! Loading your personalized path.");
        navigate("/personalized-path");
      }
    } catch (submitError) {
      setSubmitStatus("error");
      setSubmitFeedback(
        submitError.response?.data?.error || "Payment setup failed"
      );
    }
  };

  const renderQuestionInput = (question) => {
    switch (question.type) {
      case "knowledge_check":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options?.map((option, index) => {
              const isSelected = answers[question.id] === option;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAnswer(question.id, option)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40 ${
                    isSelected
                      ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        );

      case "preference_scale": {
        const selected = answers[question.id] ?? "";
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4, 5].map((value) => {
                const id = `${question.id}-scale-${value}`;
                const isChecked = selected === value.toString();
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold transition focus-within:ring-2 focus-within:ring-[color:var(--accent,#2563eb)]/40 ${
                      isChecked
                        ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)] text-white shadow-lg shadow-[color:var(--accent,#2563eb)]/30"
                        : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--text-color,#111827)] hover:border-[color:var(--accent,#2563eb)]/40"
                    }`}
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`scale-${question.id}`}
                      value={value}
                      checked={isChecked}
                      onChange={() => handleAnswer(question.id, value.toString())}
                      className="sr-only"
                    />
                    {value}
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              <span>Strongly Disagree</span>
              <span>Strongly Agree</span>
            </div>
          </div>
        );
      }

      case "budget_allocation": {
        const allocation = answers[question.id] || {};
        const total = Object.values(allocation).reduce(
          (sum, value) => sum + (parseInt(value, 10) || 0),
          0
        );

        return (
          <div className="space-y-5 rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {question.options.map((category, index) => (
                <label
                  key={`${question.id}-${index}`}
                  className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-4 shadow-sm"
                >
                  <span className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {category}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={allocation[category] ?? ""}
                      onChange={(event) =>
                        handleBudgetChange(
                          question.id,
                          category,
                          event.target.value
                        )
                      }
                      className="h-10 w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    />
                    <span className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                      %
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <div className="text-sm font-semibold text-[color:var(--accent,#111827)]">
              Total allocation: {total}%
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <Loader message="Loading questions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard padding="lg" className="max-w-md border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-center text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/20">
          {error}
        </GlassCard>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard padding="lg" className="max-w-md text-center text-sm text-[color:var(--muted-text,#6b7280)]">
          No questionnaire data available.
        </GlassCard>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = Math.round(
    ((currentQuestionIndex + 1) / questions.length) * 100
  );
  const hasAnswer = Boolean(answers[currentQuestion?.id]);

  return (
    <section className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            Step {currentQuestionIndex + 1} of {questions.length}
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Tell us about yourself
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Answer a few quick questions so we can tailor your learning
            experience.
          </p>
        </header>

        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--input-bg,#f3f4f6)] shadow-inner">
          <div
            className="h-full rounded-full bg-[color:var(--primary,#2563eb)] transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

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
            <button
              type="button"
              onClick={() =>
                setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0))
              }
              disabled={currentQuestionIndex === 0}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous
            </button>

            {currentQuestionIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasAnswer}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasAnswer || submitStatus === "submitting"}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitStatus === "submitting"
                  ? "Submitting..."
                  : "Submit Questionnaire"}
              </button>
            )}
          </div>

          {submitStatus !== "idle" && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                submitStatus === "error"
                  ? "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                  : "border-[color:var(--accent,#2563eb)]/30 bg-[color:var(--accent,#2563eb)]/5 text-[color:var(--accent,#2563eb)]"
              }`}
            >
              {submitFeedback}
            </div>
          )}
        </GlassCard>
      </div>
    </section>
  );
};

export default Questionnaire;
