import { describe, expect, it } from "vitest";
import {
  MAX_GOAL_MONTHS,
  adjustBudget,
  monthlyForGoal,
  monthsToGoal,
  savingsBalance,
  splitBudget,
} from "./calculators";

describe("savingsBalance", () => {
  it("is plain saving at a 0% rate", () => {
    expect(savingsBalance(500, 200, 24, 0)).toBe(500 + 200 * 24);
  });

  it("compounds the start sum and deposits monthly", () => {
    // £1,000 at 5% compounded monthly for 10 years is £1,647.01.
    expect(savingsBalance(1000, 0, 120, 5)).toBeCloseTo(1647.01, 2);
    // £150 a month for 20 years at 7%: £78,139 (matches the landing demo).
    expect(Math.round(savingsBalance(0, 150, 240, 7))).toBe(78139);
  });
});

describe("monthsToGoal", () => {
  it("is 0 when the start sum already covers the goal", () => {
    expect(monthsToGoal(1000, 1000, 0, 0)).toBe(0);
    expect(monthsToGoal(1000, 1500, 50, 4)).toBe(0);
  });

  it("counts whole months at a 0% rate", () => {
    expect(monthsToGoal(5000, 500, 200, 0)).toBe(23); // 4,500 / 200 = 22.5
    expect(monthsToGoal(4900, 500, 200, 0)).toBe(22); // exact hit, no extra month
  });

  it("gets there sooner with interest", () => {
    const flat = monthsToGoal(5000, 500, 200, 0)!;
    const withInterest = monthsToGoal(5000, 500, 200, 4)!;
    expect(withInterest).toBeLessThanOrEqual(flat);
    expect(savingsBalance(500, 200, withInterest, 4)).toBeGreaterThanOrEqual(5000);
    expect(savingsBalance(500, 200, withInterest - 1, 4)).toBeLessThan(5000);
  });

  it("is null when the goal is out of reach", () => {
    expect(monthsToGoal(5000, 0, 0, 4)).toBeNull();
    expect(monthsToGoal(5000, 100, 0, 0)).toBeNull();
    expect(monthsToGoal(1e9, 0, 1, 1)).toBeNull();
  });

  it("can be reached by interest alone, within the horizon", () => {
    const months = monthsToGoal(2000, 1000, 0, 5)!;
    expect(months).toBeGreaterThan(0);
    expect(months).toBeLessThanOrEqual(MAX_GOAL_MONTHS);
  });
});

describe("monthlyForGoal", () => {
  it("divides the gap evenly at a 0% rate", () => {
    expect(monthlyForGoal(5000, 500, 24, 0)).toBeCloseTo(187.5, 6);
  });

  it("is the deposit that lands exactly on the goal", () => {
    const monthly = monthlyForGoal(20000, 2000, 36, 5);
    expect(savingsBalance(2000, monthly, 36, 5)).toBeCloseTo(20000, 6);
    expect(monthly).toBeLessThan((20000 - 2000) / 36);
  });

  it("is 0 when the start sum grows into the goal on its own", () => {
    expect(monthlyForGoal(1000, 1000, 12, 0)).toBe(0);
    expect(monthlyForGoal(1040, 1000, 12, 5)).toBe(0);
  });
});

describe("splitBudget", () => {
  it("splits take-home pay 50/30/20", () => {
    expect(splitBudget(2200)).toEqual({ needs: 1100, wants: 660, savings: 440 });
  });
});

describe("adjustBudget", () => {
  it("takes overspend on essentials out of wants first", () => {
    expect(adjustBudget(2200, 1300)).toEqual({ needs: 1300, wants: 460, savings: 440 });
  });

  it("cuts savings only once wants are gone", () => {
    expect(adjustBudget(2000, 1800)).toEqual({ needs: 1800, wants: 0, savings: 200 });
    expect(adjustBudget(2000, 2500)).toEqual({ needs: 2000, wants: 0, savings: 0 });
  });

  it("sends spare money to savings when essentials cost under half", () => {
    expect(adjustBudget(2000, 800)).toEqual({ needs: 800, wants: 600, savings: 600 });
  });

  it("always adds back up to take-home pay", () => {
    for (const essentials of [0, 500, 1000, 1500, 1900, 3000]) {
      const plan = adjustBudget(2000, essentials);
      expect(plan.needs + plan.wants + plan.savings).toBeCloseTo(2000, 6);
    }
  });
});
