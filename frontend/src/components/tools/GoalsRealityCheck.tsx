import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { recordToolEvent } from "services/toolsAnalytics";
import { GOALS_LEVER_LESSONS } from "./lessonMapping";
import { formatCurrency, getLocale } from "utils/format";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:reality-check";

const demoPreset = {
  goalName: "",
  goalAmount: "6000",
  months: "12",
  currentSaved: "900",
  incomeLow: "2800",
  incomeHigh: "3200",
  expenseLow: "1900",
  expenseHigh: "2200",
};

const GoalsRealityCheck = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [form, setForm] = useState({
    goalName: "",
    goalAmount: "",
    months: "",
    currentSaved: "",
    incomeLow: "",
    incomeHigh: "",
    expenseLow: "",
    expenseHigh: "",
  });
  const localizedDemoPreset = useMemo(
    () => ({ ...demoPreset, goalName: t("tools.realityCheck.demoGoalName") }),
    [t]
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const {
    requiredMonthly,
    lowSurplus,
    highSurplus,
    progressPct,
    bestMonths,
    expectedMonths,
    worstMonths,
    warnings,
    levers,
    hasInputs,
  } = useMemo(() => {
    const goal = Number(form.goalAmount || 0);
    const months = Number(form.months || 0);
    const current = Number(form.currentSaved || 0);
    const incomeLow = Number(form.incomeLow || 0);
    const incomeHigh = Number(form.incomeHigh || 0);
    const expenseLow = Number(form.expenseLow || 0);
    const expenseHigh = Number(form.expenseHigh || 0);

    const required = months > 0 ? Math.max(goal - current, 0) / months : 0;
    const surplusLow = incomeLow - expenseHigh;
    const surplusHigh = incomeHigh - expenseLow;
    const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    const warn: string[] = [];
    const leverList: Array<{
      label: string;
      key: keyof typeof GOALS_LEVER_LESSONS;
    }> = [];

    if (goal > 0 && months > 0 && surplusHigh < required) {
      warn.push(t("tools.realityCheck.warningLowSurplus"));
      leverList.push({
        label: t("tools.realityCheck.leverIncome"),
        key: "income",
      });
    } else if (goal > 0 && months > 0 && surplusLow < required) {
      warn.push(t("tools.realityCheck.warningReduceExpenses"));
      leverList.push({
        label: t("tools.realityCheck.leverExpenses"),
        key: "expenses",
      });
    }
    if (surplusLow < 0) {
      warn.push(t("tools.realityCheck.warningExpensesHigher"));
      leverList.push({
        label: t("tools.realityCheck.leverFixedCosts"),
        key: "expenses",
      });
    }

    const avgSurplus = (surplusLow + surplusHigh) / 2;
    const remaining = Math.max(goal - current, 0);
    const best =
      remaining > 0 && surplusHigh > 0
        ? Math.ceil(remaining / surplusHigh)
        : null;
    const expected =
      remaining > 0 && avgSurplus > 0
        ? Math.ceil(remaining / avgSurplus)
        : null;
    const worst =
      remaining > 0 && surplusLow > 0
        ? Math.ceil(remaining / surplusLow)
        : null;

    return {
      requiredMonthly: required,
      lowSurplus: surplusLow,
      highSurplus: surplusHigh,
      progressPct: progress,
      bestMonths: best,
      expectedMonths: expected,
      worstMonths: worst,
      warnings: warn,
      levers: leverList.slice(0, 2),
      hasInputs: Boolean(goal || months || incomeLow || incomeHigh),
    };
  }, [form, t]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: t("tools.realityCheck.activityLabel") })
    );
  }, [t]);

  React.useEffect(() => {
    if (!hasInputs || typeof window === "undefined") return;
    const key = "monevo:tools:completed:reality-check";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    if (typeof window.gtag === "function") {
      window.gtag("event", "tool_completed", {
        tool_id: "reality-check",
        detail: "inputs_entered",
      });
    }
    recordToolEvent("tool_complete", "reality-check", {
      detail: "inputs_entered",
    });
  }, [hasInputs]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (warnings.length > 0) {
      sessionStorage.setItem("monevo:tools:signal:goals_warning", "true");
    } else {
      sessionStorage.removeItem("monevo:tools:signal:goals_warning");
    }
  }, [warnings.length]);

  return (
    <section className="space-y-6 min-w-0 w-full">
      <div className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.goalFirstFlow")}
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm(localizedDemoPreset)}
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
            >
              {t("tools.realityCheck.useDemoGoal")}
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({
                  goalName: "",
                  goalAmount: "",
                  months: "",
                  currentSaved: "",
                  incomeLow: "",
                  incomeHigh: "",
                  expenseLow: "",
                  expenseHigh: "",
                })
              }
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
            >
              {t("tools.realityCheck.clear")}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)] min-w-0">
            {t("tools.realityCheck.goalName")}
            <input
              type="text"
              name="goalName"
              value={form.goalName}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.goalNamePlaceholder")}
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.goalAmount")}
            <input
              type="number"
              name="goalAmount"
              value={form.goalAmount}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.goalAmountPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.timeframe")}
            <input
              type="number"
              name="months"
              value={form.months}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.timeframePlaceholder")}
              min="1"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.alreadySaved")}
            <input
              type="number"
              name="currentSaved"
              value={form.currentSaved}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.alreadySavedPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)] min-w-0">
            {t("tools.realityCheck.incomeLow")}
            <input
              type="number"
              name="incomeLow"
              value={form.incomeLow}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.incomeLowPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.incomeHigh")}
            <input
              type="number"
              name="incomeHigh"
              value={form.incomeHigh}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.incomeHighPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.expenseLow")}
            <input
              type="number"
              name="expenseLow"
              value={form.expenseLow}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.expenseLowPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.expenseHigh")}
            <input
              type="number"
              name="expenseHigh"
              value={form.expenseHigh}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.expenseHighPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
        </div>
      </div>

      {!hasInputs ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("tools.realityCheck.emptyState")}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.savingRange")}
            </p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-color,#111827)]">
              {formatCurrency(lowSurplus, "USD", locale)} -{" "}
              {formatCurrency(highSurplus, "USD", locale)} / month
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.requiredToHitGoal")}{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {formatCurrency(requiredMonthly, "USD", locale)} / month
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.progressTracker")}
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-[color:var(--border-color,#d1d5db)]/40">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[color:var(--accent,#ffd700)]/90 to-[color:var(--accent,#ffd700)]/45"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.youAre")}{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {Math.round(progressPct)}%
              </span>{" "}
              {t("tools.realityCheck.ofTheWayThere")}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.timeToGoal")}
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.realityCheck.best")}{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {bestMonths
                  ? `${bestMonths} ${t("tools.realityCheck.months")}`
                  : t("tools.realityCheck.notFeasible")}
              </span>{" "}
              · {t("tools.realityCheck.expected")}{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {expectedMonths
                  ? `${expectedMonths} ${t("tools.realityCheck.months")}`
                  : t("tools.realityCheck.notFeasible")}
              </span>{" "}
              · {t("tools.realityCheck.worst")}{" "}
              <span className="font-semibold text-[color:var(--text-color,#111827)]">
                {worstMonths
                  ? `${worstMonths} ${t("tools.realityCheck.months")}`
                  : t("tools.realityCheck.notFeasible")}
              </span>
            </p>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wide">
            {t("tools.realityCheck.feasibilityWarnings")}
          </p>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {levers.length > 0 && (
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)] shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            {t("tools.realityCheck.twoBigLevers")}
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {levers.map((lever) => (
              <div
                key={lever.label}
                className="rounded-xl border border-white/40 px-3 py-3"
              >
                <p className="text-sm text-[color:var(--text-color,#111827)]">
                  {lever.label}
                </p>
                <a
                  href={GOALS_LEVER_LESSONS[lever.key]}
                  className="mt-2 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)] hover:opacity-80"
                >
                  {t("tools.realityCheck.learnMore")}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default GoalsRealityCheck;
