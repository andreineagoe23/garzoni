import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { recordToolEvent } from "services/toolsAnalytics";
import { GOALS_LEVER_LESSONS } from "./lessonMapping";
import { formatCurrency, getLocale } from "utils/format";
import { requestAiTutorResponse } from "services/aiTutor";

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:reality-check";

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
  const [aiMeaning, setAiMeaning] = useState<string>("");
  const [isAiMeaningLoading, setIsAiMeaningLoading] = useState(false);
  const [aiMeaningError, setAiMeaningError] = useState<string | null>(null);

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
    const key = "garzoni:tools:completed:reality-check";
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
      sessionStorage.setItem("garzoni:tools:signal:goals_warning", "true");
    } else {
      sessionStorage.removeItem("garzoni:tools:signal:goals_warning");
    }
  }, [warnings.length]);

  const explainGoalPlan = React.useCallback(async () => {
    if (!hasInputs) return;

    const prompt = [
      "You are a practical personal finance coach.",
      "Explain this savings goal scenario in plain language.",
      `Goal name: ${form.goalName || "Savings goal"}`,
      `Goal amount: ${formatCurrency(Number(form.goalAmount || 0), "USD", locale)}`,
      `Already saved: ${formatCurrency(Number(form.currentSaved || 0), "USD", locale)}`,
      `Target timeline (months): ${form.months || 0}`,
      `Monthly surplus range: ${formatCurrency(lowSurplus, "USD", locale)} to ${formatCurrency(highSurplus, "USD", locale)}`,
      `Required monthly saving: ${formatCurrency(requiredMonthly, "USD", locale)}`,
      `Estimated time-to-goal best/expected/worst: ${bestMonths ?? "not feasible"} / ${expectedMonths ?? "not feasible"} / ${worstMonths ?? "not feasible"}`,
      warnings.length ? `Warnings: ${warnings.join("; ")}` : "Warnings: none",
      "Give:",
      "1) what this means right now,",
      "2) the biggest risk to goal success,",
      "3) one actionable next step this week.",
      "Keep it short (under 120 words).",
    ].join("\n");

    setIsAiMeaningLoading(true);
    setAiMeaningError(null);
    try {
      const response = await requestAiTutorResponse(prompt);
      if (!response) throw new Error("Empty AI response");
      setAiMeaning(response);
    } catch {
      setAiMeaningError("Could not generate AI explanation right now.");
    } finally {
      setIsAiMeaningLoading(false);
    }
  }, [
    bestMonths,
    expectedMonths,
    form.currentSaved,
    form.goalAmount,
    form.goalName,
    form.months,
    hasInputs,
    highSurplus,
    locale,
    lowSurplus,
    requiredMonthly,
    warnings,
    worstMonths,
  ]);

  return (
    <section className="space-y-6 min-w-0 w-full">
      <div className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.realityCheck.goalFirstFlow")}
            </p>
            <p className="text-sm text-content-muted">
              {t("tools.realityCheck.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm(localizedDemoPreset)}
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-content-primary transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
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
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-content-muted transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
            >
              {t("tools.realityCheck.clear")}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted min-w-0">
            {t("tools.realityCheck.goalName")}
            <input
              type="text"
              name="goalName"
              value={form.goalName}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.goalNamePlaceholder")}
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.realityCheck.goalAmount")}
            <input
              type="number"
              name="goalAmount"
              value={form.goalAmount}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.goalAmountPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.realityCheck.timeframe")}
            <input
              type="number"
              name="months"
              value={form.months}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.timeframePlaceholder")}
              min="1"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.realityCheck.alreadySaved")}
            <input
              type="number"
              name="currentSaved"
              value={form.currentSaved}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.alreadySavedPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted min-w-0">
            {t("tools.realityCheck.incomeLow")}
            <input
              type="number"
              name="incomeLow"
              value={form.incomeLow}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.incomeLowPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.realityCheck.incomeHigh")}
            <input
              type="number"
              name="incomeHigh"
              value={form.incomeHigh}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.incomeHighPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.realityCheck.expenseLow")}
            <input
              type="number"
              name="expenseLow"
              value={form.expenseLow}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.expenseLowPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-content-muted">
            {t("tools.realityCheck.expenseHigh")}
            <input
              type="number"
              name="expenseHigh"
              value={form.expenseHigh}
              onChange={handleChange}
              placeholder={t("tools.realityCheck.expenseHighPlaceholder")}
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-content-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </label>
        </div>
      </div>

      {!hasInputs ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-6 text-center text-sm text-content-muted">
          {t("tools.realityCheck.emptyState")}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.realityCheck.savingRange")}
            </p>
            <p className="mt-2 text-lg font-semibold text-content-primary">
              {formatCurrency(lowSurplus, "USD", locale)} -{" "}
              {formatCurrency(highSurplus, "USD", locale)} / month
            </p>
            <p className="mt-2 text-sm text-content-muted">
              {t("tools.realityCheck.requiredToHitGoal")}{" "}
              <span className="font-semibold text-content-primary">
                {formatCurrency(requiredMonthly, "USD", locale)} / month
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.realityCheck.progressTracker")}
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-[color:var(--border-color,#d1d5db)]/40">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[color:var(--accent,#ffd700)]/90 to-[color:var(--accent,#ffd700)]/45"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-content-muted">
              {t("tools.realityCheck.youAre")}{" "}
              <span className="font-semibold text-content-primary">
                {Math.round(progressPct)}%
              </span>{" "}
              {t("tools.realityCheck.ofTheWayThere")}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.realityCheck.timeToGoal")}
            </p>
            <p className="mt-2 text-sm text-content-muted">
              {t("tools.realityCheck.best")}{" "}
              <span className="font-semibold text-content-primary">
                {bestMonths
                  ? `${bestMonths} ${t("tools.realityCheck.months")}`
                  : t("tools.realityCheck.notFeasible")}
              </span>{" "}
              · {t("tools.realityCheck.expected")}{" "}
              <span className="font-semibold text-content-primary">
                {expectedMonths
                  ? `${expectedMonths} ${t("tools.realityCheck.months")}`
                  : t("tools.realityCheck.notFeasible")}
              </span>{" "}
              · {t("tools.realityCheck.worst")}{" "}
              <span className="font-semibold text-content-primary">
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
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 text-sm text-content-muted shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            {t("tools.realityCheck.twoBigLevers")}
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {levers.map((lever) => (
              <div
                key={lever.label}
                className="rounded-xl border border-white/40 px-3 py-3"
              >
                <p className="text-sm text-content-primary">{lever.label}</p>
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

      {hasInputs && (
        <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 text-sm text-content-muted shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              AI explanation
            </p>
            <button
              type="button"
              onClick={explainGoalPlan}
              disabled={isAiMeaningLoading}
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-content-primary transition hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] disabled:opacity-60"
            >
              {isAiMeaningLoading
                ? "Thinking..."
                : "What does this mean for me?"}
            </button>
          </div>
          {aiMeaningError && (
            <p className="mt-2 text-xs text-[color:var(--error,#dc2626)]">
              {aiMeaningError}
            </p>
          )}
          {aiMeaning && (
            <p className="mt-2 whitespace-pre-line text-sm text-content-primary">
              {aiMeaning}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default GoalsRealityCheck;
