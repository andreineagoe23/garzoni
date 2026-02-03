import React, { useMemo, useState } from "react";
import { recordToolEvent } from "services/toolsAnalytics";
import { GOALS_LEVER_LESSONS } from "./lessonMapping";
import { formatCurrency, getLocale } from "utils/format";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:reality-check";

const demoPreset = {
  goalName: "Emergency fund",
  goalAmount: "6000",
  months: "12",
  currentSaved: "900",
  incomeLow: "2800",
  incomeHigh: "3200",
  expenseLow: "1900",
  expenseHigh: "2200",
};

const GoalsRealityCheck = () => {
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
    const leverList: Array<{ label: string; key: keyof typeof GOALS_LEVER_LESSONS }> = [];

    if (goal > 0 && months > 0 && surplusHigh < required) {
      warn.push(
        "Even your best-month surplus looks too low for this timeline."
      );
      leverList.push({ label: "Increase monthly income or extend the timeline", key: "income" });
    } else if (goal > 0 && months > 0 && surplusLow < required) {
      warn.push(
        "You’ll likely need to reduce expenses or extend the timeline."
      );
      leverList.push({ label: "Reduce monthly expenses by a small amount", key: "expenses" });
    }
    if (surplusLow < 0) {
      warn.push("Expenses may be higher than income in a typical month.");
      leverList.push({ label: "Lower fixed costs to regain breathing room", key: "expenses" });
    }

    const avgSurplus = (surplusLow + surplusHigh) / 2;
    const remaining = Math.max(goal - current, 0);
    const best =
      remaining > 0 && surplusHigh > 0
        ? Math.ceil(remaining / surplusHigh)
        : null;
    const expected =
      remaining > 0 && avgSurplus > 0 ? Math.ceil(remaining / avgSurplus) : null;
    const worst =
      remaining > 0 && surplusLow > 0 ? Math.ceil(remaining / surplusLow) : null;

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
  }, [form]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: "Checked goal feasibility" })
    );
  }, []);

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
              Goal-first flow
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Define the goal, then sanity-check your monthly reality.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm(demoPreset)}
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
            >
              Use demo goal
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
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)] min-w-0">
            Goal name
            <input
              type="text"
              name="goalName"
              value={form.goalName}
              onChange={handleChange}
              placeholder="Emergency fund, trip, debt payoff"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Goal amount
            <input
              type="number"
              name="goalAmount"
              value={form.goalAmount}
              onChange={handleChange}
              placeholder="6000"
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Timeframe (months)
            <input
              type="number"
              name="months"
              value={form.months}
              onChange={handleChange}
              placeholder="12"
              min="1"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Already saved
            <input
              type="number"
              name="currentSaved"
              value={form.currentSaved}
              onChange={handleChange}
              placeholder="900"
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)] min-w-0">
            Monthly income range (low)
            <input
              type="number"
              name="incomeLow"
              value={form.incomeLow}
              onChange={handleChange}
              placeholder="2800"
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Monthly income range (high)
            <input
              type="number"
              name="incomeHigh"
              value={form.incomeHigh}
              onChange={handleChange}
              placeholder="3200"
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Monthly expense range (low)
            <input
              type="number"
              name="expenseLow"
              value={form.expenseLow}
              onChange={handleChange}
              placeholder="1900"
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
            Monthly expense range (high)
            <input
              type="number"
              name="expenseHigh"
              value={form.expenseHigh}
              onChange={handleChange}
              placeholder="2200"
              min="0"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
            />
          </label>
        </div>
      </div>

      {!hasInputs ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
          Start by entering a goal amount and timeframe to see a realistic range.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Realistic saving range
            </p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--accent,#111827)]">
              {formatCurrency(lowSurplus, "USD", locale)} –{" "}
              {formatCurrency(highSurplus, "USD", locale)} / month
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              Required to hit goal:{" "}
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                {formatCurrency(requiredMonthly, "USD", locale)} / month
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Progress tracker
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-[color:var(--border-color,#d1d5db)]/40">
              <div
                className="h-2 rounded-full bg-[color:var(--primary,#2563eb)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              You’re{" "}
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                {Math.round(progressPct)}%
              </span>{" "}
              of the way there.
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 shadow-sm min-w-0 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Time to goal (range)
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              Best:{" "}
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                {bestMonths ? `${bestMonths} months` : "Not feasible yet"}
              </span>{" "}
              · Expected:{" "}
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                {expectedMonths ? `${expectedMonths} months` : "Not feasible yet"}
              </span>{" "}
              · Worst:{" "}
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                {worstMonths ? `${worstMonths} months` : "Not feasible yet"}
              </span>
            </p>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Feasibility warnings
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
            Two big levers
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {levers.map((lever) => (
              <div key={lever.label} className="rounded-xl border border-white/40 px-3 py-3">
                <p className="text-sm text-[color:var(--text-color,#111827)]">
                  {lever.label}
                </p>
                <a
                  href={GOALS_LEVER_LESSONS[lever.key]}
                  className="mt-2 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)] hover:opacity-80"
                >
                  Learn more →
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
