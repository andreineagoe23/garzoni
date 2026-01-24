import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { BACKEND_URL } from "services/backendUrl";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatDate, formatNumber, getLocale } from "utils/format";

const STATUS_COLORS = {
  not_started: "bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]",
  in_progress: "bg-[color:var(--primary,#2563eb)]/10 text-[color:var(--primary,#2563eb)]",
  completed: "bg-emerald-500/10 text-emerald-400",
};

const FinancialGoalsTracker = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newGoal, setNewGoal] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
    target_date: "",
  });
  const { getAccessToken } = useAuth();
  const { t } = useTranslation("tools");
  const locale = getLocale();

  const fetchGoals = useCallback(async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/financial-goals/`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      setGoals(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching financial goals:", err);
      setError(t("goals.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, t]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setNewGoal((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddGoal = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(
        `${BACKEND_URL}/financial-goals/`,
        newGoal,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      setGoals((prev) => [...prev, response.data]);
      setNewGoal({
        name: "",
        target_amount: "",
        current_amount: "",
        target_date: "",
      });
      setError(null);
    } catch (err) {
      console.error("Error adding new goal:", err);
      setError(t("goals.errors.add"));
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/financial-goals/${goalId}/`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
    } catch (err) {
      console.error("Error deleting goal:", err);
      setError(t("goals.errors.delete"));
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {t("goals.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("goals.subtitle")}
        </p>
      </header>

      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <form
          onSubmit={handleAddGoal}
          className="grid gap-4 md:grid-cols-2"
          noValidate
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("goals.form.name")}
            <input
              type="text"
              name="name"
              value={newGoal.name}
              onChange={handleInputChange}
              placeholder={t("goals.form.namePlaceholder")}
              required
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("goals.form.targetAmount")}
            <input
              type="number"
              name="target_amount"
              value={newGoal.target_amount}
              onChange={handleInputChange}
              placeholder={t("goals.form.targetPlaceholder")}
              required
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("goals.form.currentAmount")}
            <input
              type="number"
              name="current_amount"
              value={newGoal.current_amount}
              onChange={handleInputChange}
              placeholder={t("goals.form.currentPlaceholder")}
              required
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("goals.form.targetDate")}
            <input
              type="date"
              name="target_date"
              value={newGoal.target_date}
              onChange={handleInputChange}
              required
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            >
              {t("goals.form.submit")}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-6 text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
            {t("goals.loading")}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
            {error}
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-6 text-sm text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
            {t("goals.empty")}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.map((goal) => {
              const progress =
                goal.target_amount > 0
                  ? Math.min(
                      (goal.current_amount / goal.target_amount) * 100,
                      100
                    )
                  : 0;
              const remainingAmount = Math.max(
                goal.target_amount - goal.current_amount,
                0
              );
              return (
                <article
                  key={goal.id}
                  className="flex flex-col rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-white px-5 py-4 shadow-xl shadow-black/5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                      {goal.name}
                    </h4>
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                        STATUS_COLORS[goal.status] ||
                          STATUS_COLORS["not_started"],
                      ].join(" ")}
                    >
                      {t(`goals.status.${goal.status}`, {
                        defaultValue: goal.status.replace("_", " "),
                      })}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                    {t("goals.targetSummary", {
                      target: formatCurrency(
                        Number(goal.target_amount || 0),
                        "USD",
                        locale,
                        { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                      ),
                      current: formatCurrency(
                        Number(goal.current_amount || 0),
                        "USD",
                        locale,
                        { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                      ),
                    })}
                  </p>
                  <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                    {t("goals.targetDateLabel")}{" "}
                    {goal.target_date
                      ? formatDate(goal.target_date, locale)
                      : t("goals.noDate")}
                  </p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
                      <span>{t("goals.progress")}</span>
                      <span className="text-[color:var(--accent,#111827)]">
                        {formatNumber(progress, locale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                      <div
                        className="h-2 rounded-full bg-[color:var(--primary,#2563eb)] transition-[width] duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                    <span>
                      {t("goals.remaining", {
                        amount: formatCurrency(
                          Number(remainingAmount || 0),
                          "USD",
                          locale,
                          { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                        ),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                    >
                      {t("goals.delete")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default FinancialGoalsTracker;
