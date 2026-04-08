export type RealityCheckForm = {
  goalName: string;
  goalAmount: string;
  months: string;
  currentSaved: string;
  incomeLow: string;
  incomeHigh: string;
  expenseLow: string;
  expenseHigh: string;
};

export type RealityCheckResult = {
  requiredMonthly: number;
  lowSurplus: number;
  highSurplus: number;
  progressPct: number;
  bestMonths: number | null;
  expectedMonths: number | null;
  worstMonths: number | null;
  warnings: string[];
  feasible: boolean;
  projection: { month: number; saved: number }[];
};

export function calcRealityCheck(form: RealityCheckForm): RealityCheckResult {
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
  const avgSurplus = (surplusLow + surplusHigh) / 2;
  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - current, 0);

  const warnings: string[] = [];
  if (goal > 0 && months > 0 && surplusHigh < required) {
    warnings.push(
      "Your maximum surplus may not cover the required monthly saving.",
    );
  } else if (goal > 0 && months > 0 && surplusLow < required) {
    warnings.push("Your surplus may be tight — consider reducing expenses.");
  }
  if (surplusLow < 0) {
    warnings.push("Expenses may exceed income in a bad month.");
  }

  const best =
    remaining > 0 && surplusHigh > 0
      ? Math.ceil(remaining / surplusHigh)
      : null;
  const expected =
    remaining > 0 && avgSurplus > 0 ? Math.ceil(remaining / avgSurplus) : null;
  const worst =
    remaining > 0 && surplusLow > 0 ? Math.ceil(remaining / surplusLow) : null;

  // Build projection using avg surplus, capped at months or 60
  const projLen = months > 0 ? months : (expected ?? 24);
  const cappedLen = Math.min(projLen, 60);
  const projection: { month: number; saved: number }[] = [];
  for (let m = 0; m <= cappedLen; m++) {
    projection.push({
      month: m,
      saved: Math.min(current + avgSurplus * m, goal > 0 ? goal : Infinity),
    });
  }

  return {
    requiredMonthly: required,
    lowSurplus: surplusLow,
    highSurplus: surplusHigh,
    progressPct: progress,
    bestMonths: best,
    expectedMonths: expected,
    worstMonths: worst,
    warnings,
    feasible: warnings.length === 0 && required > 0,
    projection,
  };
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
