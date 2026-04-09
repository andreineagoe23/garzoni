import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getLocale,
} from "utils/format";

const STATUS_COLORS = {
  not_started: "bg-[color:var(--input-bg,#f3f4f6)] text-content-muted",
  in_progress:
    "bg-[color:var(--primary,#1d5330)]/10 text-[color:var(--primary,#1d5330)]",
  completed: "bg-emerald-500/10 text-[color:var(--accent,#ffd700)]",
};

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:goals";

const FinancialGoalsTracker = () => {
  const { t } = useTranslation();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newGoal, setNewGoal] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
    target_date: "",
  });
  const locale = getLocale();
  const presets = useMemo(
    () => [
      {
        label: t("tools.goalsTracker.presetEmergency"),
        values: {
          name: t("tools.goalsTracker.defaultGoalName"),
          target_amount: "10000",
          current_amount: "1000",
          target_date: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          )
            .toISOString()
            .split("T")[0],
        },
      },
      {
        label: t("tools.goalsTracker.presetVacation"),
        values: {
          name: "Vacation Trip",
          target_amount: "3000",
          current_amount: "500",
          target_date: new Date(new Date().setMonth(new Date().getMonth() + 6))
            .toISOString()
            .split("T")[0],
        },
      },
    ],
    [t]
  );

  const fetchGoals = useCallback(async () => {
    try {
      const response = await apiClient.get("/financial-goals/");
      setGoals(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching financial goals:", err);
      setError(t("tools.goalsTracker.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({
        label: t("tools.goalsTracker.activityLabel", { count: goals.length }),
      })
    );
  }, [goals.length, t]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setNewGoal((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddGoal = async (event) => {
    event.preventDefault();
    try {
      const response = await apiClient.post("/financial-goals/", newGoal);
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
      setError(t("tools.goalsTracker.addFailed"));
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await apiClient.delete(`/financial-goals/${goalId}/`);
      setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
    } catch (err) {
      console.error("Error deleting goal:", err);
      setError(t("tools.goalsTracker.deleteFailed"));
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {t("tools.goalsTracker.title")}
        </h3>
        <p className="text-sm text-content-muted">
          {t("tools.goalsTracker.subtitle")}
        </p>
      </header>

      <div
        className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-6 py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            {t("tools.goalsTracker.demoPresets")}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setNewGoal(preset.values)}
                className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-content-muted">
            <li>• {t("tools.goalsTracker.presetTip1")}</li>
            <li>• {t("tools.goalsTracker.presetTip2")}</li>
            <li>• {t("tools.goalsTracker.presetTip3")}</li>
          </ul>
        </div>
        <form
          onSubmit={handleAddGoal}
          className="grid gap-4 md:grid-cols-2"
          noValidate
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.goalsTracker.goalName")}
            <input
              type="text"
              name="name"
              value={newGoal.name}
              onChange={handleInputChange}
              placeholder={t("tools.goalsTracker.goalNamePlaceholder")}
              required
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.goalsTracker.targetAmount")}
            <input
              type="number"
              name="target_amount"
              value={newGoal.target_amount}
              onChange={handleInputChange}
              placeholder={t("tools.goalsTracker.targetAmountPlaceholder")}
              required
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.goalsTracker.currentAmount")}
            <input
              type="number"
              name="current_amount"
              value={newGoal.current_amount}
              onChange={handleInputChange}
              placeholder={t("tools.goalsTracker.currentAmountPlaceholder")}
              required
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.goalsTracker.targetDate")}
            <input
              type="date"
              name="target_date"
              value={newGoal.target_date}
              onChange={handleInputChange}
              required
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent,#ffd700)]/30 transition hover:shadow-xl hover:shadow-[color:var(--accent,#ffd700)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            >
              {t("tools.goalsTracker.addGoal")}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-6 text-sm text-content-muted shadow-inner shadow-black/5">
            {t("tools.goalsTracker.loading")}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
            {error}
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-6 text-sm text-content-muted shadow-inner shadow-black/5">
            <p className="font-semibold text-[color:var(--accent,#111827)]">
              {t("tools.goalsTracker.emptyTitle")}
            </p>
            <p className="mt-1">{t("tools.goalsTracker.emptySubtitle")}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.map((goal) => {
              const progress =
                goal.target_amount > 0
                  ? Math.min(
                      (Number(goal.current_amount) /
                        Number(goal.target_amount)) *
                        100,
                      100
                    )
                  : 0;
              const remainingAmount = Math.max(
                Number(goal.target_amount) - Number(goal.current_amount),
                0
              );
              const statusKey =
                goal.status === "completed" ||
                goal.status === "in_progress" ||
                goal.status === "not_started"
                  ? goal.status
                  : "not_started";
              const displayName = goal.goal_name ?? goal.name ?? "";
              const deadline = goal.deadline ?? goal.target_date;
              return (
                <article
                  key={goal.id}
                  className="flex flex-col rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-white px-5 py-4 shadow-xl shadow-black/5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                      {displayName}
                    </h4>
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                        STATUS_COLORS[statusKey] ||
                          STATUS_COLORS["not_started"],
                      ].join(" ")}
                    >
                      {statusKey
                        .replace("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-content-muted">
                    {t("tools.goalsTracker.target")}:{" "}
                    {formatCurrency(
                      Number(goal.target_amount || 0),
                      "USD",
                      locale,
                      { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                    )}{" "}
                    | {t("tools.goalsTracker.current")}:{" "}
                    {formatCurrency(
                      Number(goal.current_amount || 0),
                      "USD",
                      locale,
                      { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                    )}
                  </p>
                  <p className="text-xs text-content-muted">
                    {t("tools.goalsTracker.targetDateLabel")}:{" "}
                    {deadline
                      ? formatDate(deadline, locale)
                      : t("tools.goalsTracker.notSet")}
                  </p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-medium text-content-muted">
                      <span>{t("tools.goalsTracker.progress")}</span>
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
                        className="h-2 rounded-full bg-[color:var(--primary,#1d5330)] transition-[width] duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
                    <span>
                      {t("tools.goalsTracker.remaining")}:{" "}
                      {formatCurrency(
                        Number(remainingAmount || 0),
                        "USD",
                        locale,
                        { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
                    >
                      {t("tools.goalsTracker.delete")}
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
