import React, { useEffect, useMemo, useState } from "react";
import { GlassCard, GlassButton } from "components/ui";
import Skeleton from "components/common/Skeleton";
import { formatCurrency, getLocale } from "utils/format";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:sandbox";

const FinancialSandbox = () => {
  const [monthlyContribution, setMonthlyContribution] = useState(100);
  const [years, setYears] = useState(5);
  const [averageReturn, setAverageReturn] = useState(7);
  const [running, setRunning] = useState(false);
  const locale = getLocale();

  const projection = useMemo(() => {
    const months = years * 12;
    const monthlyRate = averageReturn / 100 / 12;
    let balance = 0;
    for (let i = 0; i < months; i++) {
      balance = (balance + monthlyContribution) * (1 + monthlyRate);
    }
    return balance;
  }, [averageReturn, monthlyContribution, years]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: `${years} yrs @ ${averageReturn}%` })
    );
  }, [averageReturn, years]);

  return (
    <GlassCard padding="lg" className="space-y-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
          Financial Sandbox
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Experiment with contribution amounts, time horizons, and expected annual returns without touching your tracked data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-[color:var(--muted-text,#6b7280)]">
          Monthly Contribution
          <input
            type="number"
            min="0"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-3 py-2 text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[color:var(--muted-text,#6b7280)]">
          Years
          <input
            type="number"
            min="1"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-3 py-2 text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[color:var(--muted-text,#6b7280)]">
          Average Return (%)
          <input
            type="number"
            min="0"
            value={averageReturn}
            onChange={(e) => setAverageReturn(Number(e.target.value))}
            className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-3 py-2 text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)] focus:outline-none"
          />
        </label>
      </div>

      <GlassButton
        type="button"
        onClick={() => setRunning(true)}
        variant="primary"
        className="w-full sm:w-auto"
      >
        Start Projection
      </GlassButton>

      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-3 text-xs text-[color:var(--muted-text,#6b7280)]">
        <p className="font-semibold uppercase tracking-wide">Try this</p>
        <ul className="mt-2 space-y-1">
          <li>• Double your monthly contribution and compare outcomes</li>
          <li>• Increase the horizon to 15+ years to see compounding</li>
          <li>• Lower the return rate to stress-test projections</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)]/70 px-4 py-3 shadow-inner">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          Projected Value in {years} {years === 1 ? 'year' : 'years'}
        </p>
        {running ? (
          <Skeleton className="mt-2 h-8 w-40 rounded-lg" />
        ) : (
          <p className="mt-2 text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {formatCurrency(projection, "USD", locale, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        )}
      </div>
    </GlassCard>
  );
};

export default FinancialSandbox;
