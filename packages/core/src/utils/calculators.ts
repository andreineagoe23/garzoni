/**
 * Maths behind the public savings calculators. Money compounds monthly at a
 * twelfth of the yearly rate, and each monthly deposit lands at the end of the
 * month — the same convention as the compound interest calculator.
 */

/** Longest horizon the savings-goal calculator will project: 100 years. */
export const MAX_GOAL_MONTHS = 1200;

const monthlyRate = (ratePct: number) => ratePct / 100 / 12;

/** Balance after `months` from a starting sum plus a fixed monthly deposit. */
export function savingsBalance(
  start: number,
  monthly: number,
  months: number,
  ratePct: number,
): number {
  const i = monthlyRate(ratePct);
  if (i === 0) return start + monthly * months;
  const growth = Math.pow(1 + i, months);
  return start * growth + monthly * ((growth - 1) / i);
}

/**
 * Whole months until the balance reaches `target`; 0 when it already has, and
 * null when it would take longer than MAX_GOAL_MONTHS (or never happens).
 */
export function monthsToGoal(
  target: number,
  start: number,
  monthly: number,
  ratePct: number,
): number | null {
  if (start >= target) return 0;
  const i = monthlyRate(ratePct);
  let balance = start;
  for (let month = 1; month <= MAX_GOAL_MONTHS; month += 1) {
    balance = balance * (1 + i) + monthly;
    // A hair of tolerance so float drift can't add a month to an exact hit.
    if (balance >= target - 1e-6) return month;
  }
  return null;
}

/** Monthly deposit that reaches `target` in `months`; 0 when the start sum gets there alone. */
export function monthlyForGoal(
  target: number,
  start: number,
  months: number,
  ratePct: number,
): number {
  if (months <= 0) return Math.max(target - start, 0);
  const i = monthlyRate(ratePct);
  const growth = Math.pow(1 + i, months);
  const shortfall = target - start * growth;
  if (shortfall <= 0) return 0;
  return i === 0 ? shortfall / months : (shortfall * i) / (growth - 1);
}

export type BudgetSplit = {
  needs: number;
  wants: number;
  savings: number;
};

/** The 50/30/20 rule: half of take-home pay to needs, 30% to wants, 20% to savings. */
export function splitBudget(income: number): BudgetSplit {
  return { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 };
}

/**
 * A 50/30/20 plan rebuilt around what essentials really cost. Savings keep their
 * 20% while wants can absorb the overspend; if essentials cost less than half,
 * wants stay at 30% and the spare goes to savings.
 */
export function adjustBudget(income: number, essentials: number): BudgetSplit {
  const needs = Math.min(Math.max(essentials, 0), Math.max(income, 0));
  const left = Math.max(income, 0) - needs;
  const target = splitBudget(income);
  if (needs <= target.needs) {
    return { needs, wants: target.wants, savings: left - target.wants };
  }
  const savings = Math.min(target.savings, left);
  return { needs, wants: left - savings, savings };
}
