export type SavingsForm = {
  savingsGoal: string;
  initialAmount: string;
  monthlyContribution: string;
  annualRate: string;
  years: string;
};

export type SavingsResult = {
  futureValue: number;
  totalContributed: number;
  interestEarned: number;
  monthsToGoal: number | null;
  chartData: { month: number; value: number }[];
};

/** Compound interest future value formula */
export function calcSavings(form: SavingsForm): SavingsResult | null {
  const P = Number(form.initialAmount || 0);
  const PMT = Number(form.monthlyContribution || 0);
  const annualRate = Number(form.annualRate || 0);
  const years = Number(form.years || 0);
  const goal = Number(form.savingsGoal || 0);

  if (years <= 0) return null;

  const r = annualRate / 100 / 12; // monthly rate
  const n = Math.round(years * 12);

  let fv: number;
  if (r === 0) {
    fv = P + PMT * n;
  } else {
    fv = P * Math.pow(1 + r, n) + PMT * ((Math.pow(1 + r, n) - 1) / r);
  }

  const totalContributed = P + PMT * n;
  const interestEarned = fv - totalContributed;

  // Chart: monthly values
  const chartData: { month: number; value: number }[] = [];
  for (let m = 0; m <= n; m++) {
    let v: number;
    if (r === 0) {
      v = P + PMT * m;
    } else {
      v = P * Math.pow(1 + r, m) + PMT * ((Math.pow(1 + r, m) - 1) / r);
    }
    chartData.push({ month: m, value: v });
  }

  // Months to reach goal
  let monthsToGoal: number | null = null;
  if (goal > 0) {
    if (fv >= goal) {
      const idx = chartData.findIndex((d) => d.value >= goal);
      monthsToGoal = idx >= 0 ? idx : n;
    }
  }

  return { futureValue: fv, totalContributed, interestEarned, monthsToGoal, chartData };
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
