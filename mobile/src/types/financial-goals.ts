export type GoalStatus = "not_started" | "in_progress" | "completed";

export type FinancialGoalDto = {
  id: number;
  goal_name: string;
  target_amount: string | number;
  current_amount: string | number;
  deadline: string | null;
  created_at?: string;
  updated_at?: string;
  progress_percentage?: number;
  remaining_amount?: number;
  days_remaining?: number | null;
  status?: GoalStatus;
};

export type GoalFormState = {
  goal_name: string;
  target_amount: string;
  current_amount: string;
  deadline: string;
};

export const EMPTY_GOAL_FORM: GoalFormState = {
  goal_name: "",
  target_amount: "",
  current_amount: "",
  deadline: "",
};

export function num(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function goalProgressPct(goal: FinancialGoalDto): number {
  const t = num(goal.target_amount);
  if (t <= 0) return 0;
  return Math.min((num(goal.current_amount) / t) * 100, 100);
}

export function normalizeStatus(goal: FinancialGoalDto): GoalStatus {
  const s = goal.status;
  if (s === "completed" || s === "in_progress" || s === "not_started") return s;
  return deriveStatus(goal);
}

function deriveStatus(goal: FinancialGoalDto): GoalStatus {
  const t = num(goal.target_amount);
  const c = num(goal.current_amount);
  if (t <= 0) return "not_started";
  if (c >= t) return "completed";
  if (c > 0) return "in_progress";
  return "not_started";
}

export function formatGoalMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatGoalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
