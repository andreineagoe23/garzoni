import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

const BudgetAllocationExercise = ({ data, onComplete, isCompleted }) => {
  const { question, categories = [], total = 0, id } = data || {};
  const { getAccessToken } = useAuth();
  const initialAllocations = useMemo(() => {
    if (!Array.isArray(categories)) return {};
    return categories.reduce((acc, category) => {
      acc[category] = "";
      return acc;
    }, {});
  }, [categories]);

  const [allocations, setAllocations] = useState(initialAllocations);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState(null);

  useEffect(() => {
    setAllocations(initialAllocations);
    setFeedback("");
    setFeedbackType(null);
  }, [initialAllocations, isCompleted]);

  const currentTotal = useMemo(() => {
    return Object.values(allocations).reduce(
      (sum, val) => sum + (val ? parseInt(val, 10) || 0 : 0),
      0
    );
  }, [allocations]);

  const handleChange = (category, value) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setAllocations((prev) => ({
      ...prev,
      [category]: sanitized,
    }));
  };

  const handleSubmit = async () => {
    if (currentTotal === total) {
      setFeedback("Great job! Your budget allocation is correct!");
      setFeedbackType("success");
      try {
        await onComplete();
      } catch (error) {
        setFeedback("Error saving progress. Please try again.");
        setFeedbackType("error");
      }
    } else {
      setFeedback(
        `Your total must be ${total}. Current total: ${currentTotal}`
      );
      setFeedbackType("error");
    }
  };

  const handleRetry = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/reset/`,
        { section_id: id },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setAllocations(initialAllocations);
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
          Allocate your budget across the categories below. Make sure the total
          adds up to {total}.
        </p>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {categories?.map((category) => (
          <label
            key={category}
            className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 transition hover:border-[color:var(--accent,#2563eb)]/40"
          >
            <span className="text-sm font-semibold text-[color:var(--accent,#111827)]">
              {category}
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={allocations[category] ?? ""}
              onChange={(event) => handleChange(category, event.target.value)}
              disabled={isCompleted}
              className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-white px-3 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30 disabled:cursor-not-allowed disabled:opacity-60"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="0"
            />
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
        <span>
          Current Total:{" "}
          <span className="font-semibold text-[color:var(--accent,#111827)]">
            ${currentTotal}
          </span>
        </span>
        <span>
          Target:{" "}
          <span className="font-semibold text-[color:var(--accent,#111827)]">
            ${total}
          </span>
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
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
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            Submit Allocation
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

export default BudgetAllocationExercise;
