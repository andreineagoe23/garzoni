import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import apiClient from "services/httpClient";
import { recordToolEvent } from "services/toolsAnalytics";
import { recordFunnelEvent } from "services/analyticsService";
import { formatCurrency, formatNumber, getLocale } from "utils/format";
import CFOCoachPanel from "./CFOCoachPanel";

type AllocationRow = {
  asset_type: string;
  value: number;
  share_pct: number;
};

type Holding = {
  symbol: string;
  asset_type: string;
  quantity: number;
  purchase_price: number;
  current_price: number;
  value: number;
  gain_loss: number;
  gain_loss_pct: number;
  purchase_date?: string | null;
};

type GoalRow = {
  id: number;
  name: string;
  target: number;
  current: number;
  progress_pct: number;
  remaining: number;
  deadline: string | null;
  projected_date: string | null;
  months_required: number | null;
  on_track: boolean | null;
};

type SpendingCategoryRow = {
  category: string;
  label: string;
  spent: number;
  target: number | null;
  over_budget: boolean;
};

type ProjectionHorizon = {
  years: number;
  value: number;
  gain: number;
};

type Scenario = {
  name: "conservative" | "moderate" | "optimistic";
  annual_rate_pct: number;
  horizons: ProjectionHorizon[];
};

type TimelinePoint = {
  year: number;
  conservative: number;
  moderate: number;
  optimistic: number;
};

type DashboardPayload = {
  generated_at: string;
  currency: string;
  net_worth: {
    total: number;
    currency: string;
    breakdown: { label: string; value: number; kind: string }[];
    linked_accounts_available: boolean;
  };
  portfolio: {
    total_value: number;
    total_cost: number;
    total_gain_loss: number;
    total_gain_loss_pct: number;
    holdings_count: number;
    risk_score: number;
    diversification:
      "well_diversified" | "moderately_diversified" | "concentrated";
    allocation: AllocationRow[];
    top_holdings: Holding[];
  };
  goals: GoalRow[];
  goals_summary: { total: number; on_track: number };
  spending: {
    available: boolean;
    currency: string;
    period_start?: string;
    income: number;
    spent: number;
    net_cash_flow: number;
    savings_rate_pct: number | null;
    by_category: SpendingCategoryRow[];
  };
  projections: {
    starting_balance: number;
    monthly_contribution: number;
    scenarios: Scenario[];
    timeline: TimelinePoint[];
  };
  ai_analysis: {
    text: string;
    source: "ai" | "fallback";
    status?: "ready" | "pending";
  };
  context: {
    monthly_contribution: number;
    real_holdings_count: number;
    risk_score: number;
  };
};

const ALLOCATION_COLORS = [
  "#1d5330",
  "#2a7347",
  "#6db389",
  "#9bd1ad",
  "#c2e8ce",
  "#b45309",
  "#fbbf24",
  "#3b82f6",
];

const SCENARIO_COLORS: Record<Scenario["name"], string> = {
  conservative: "#9bd1ad",
  moderate: "#2a7347",
  optimistic: "#1d5330",
};

type Props = {
  onReviewSteps: () => void;
};

const CFODashboard = ({ onReviewSteps }: Props) => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/personal-cfo/dashboard/?surface=web");
      setData(res.data as DashboardPayload);
    } catch (err) {
      const e = err as {
        response?: { status?: number; data?: { error?: string } };
      };
      if (e?.response?.status === 402) {
        setError(t("tools.cfoDashboard.errors.upgradeRequired"));
      } else {
        setError(
          e?.response?.data?.error || t("tools.cfoDashboard.errors.loadFailed")
        );
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    recordToolEvent("personal_cfo_dashboard_open", "personal-cfo");
    recordFunnelEvent("personal_cfo_dashboard_open", {
      metadata: { surface: "web" },
    }).catch(() => undefined);
  }, [load]);

  // Dashboard responds instantly with a deterministic narrative and status
  // "pending" while the AI text generates in the background — poll the
  // lightweight narrative endpoint until it flips to "ready".
  const narrativePending = data?.ai_analysis?.status === "pending";
  useEffect(() => {
    if (!narrativePending) return undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts > 15) {
        window.clearInterval(timer);
        return;
      }
      apiClient
        .get("/personal-cfo/narrative/?surface=web")
        .then((res) => {
          const block = res.data as DashboardPayload["ai_analysis"];
          if (block?.status === "ready") {
            window.clearInterval(timer);
            setData((prev) => (prev ? { ...prev, ai_analysis: block } : prev));
          }
        })
        .catch(() => window.clearInterval(timer));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [narrativePending]);

  const fmt = useCallback(
    (value: number, fractionDigits = 0) =>
      formatCurrency(value, data?.currency || "USD", locale, {
        maximumFractionDigits: fractionDigits,
      }),
    [data?.currency, locale]
  );

  const allocationData = useMemo(() => {
    if (!data) return [];
    return data.portfolio.allocation.map((row) => ({
      name: t(`tools.portfolio.assetType.${row.asset_type}`),
      value: row.value,
    }));
  }, [data, t]);

  if (loading) {
    return (
      <div className="app-card app-card--pad-lg text-sm text-content-muted">
        {t("tools.cfoDashboard.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-card app-card--pad-lg">
        <p className="text-sm text-content-muted">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-default)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-content-primary"
        >
          {t("tools.cfoDashboard.retry")}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const netWorth = data.net_worth.total;
  const savingsRate = data.spending.savings_rate_pct;
  const riskScore = data.portfolio.risk_score;
  const hasPortfolio = data.portfolio.holdings_count > 0;
  const hasSpending = data.spending.available && data.spending.income > 0;
  const hasGoals = data.goals.length > 0;

  return (
    <section className="space-y-5 min-w-0 w-full">
      <header className="app-card app-card--pad-lg overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.cfoDashboard.eyebrow")}
            </p>
            <h2 className="app-display text-2xl text-content-primary sm:text-3xl">
              {t("tools.cfoDashboard.title")}
            </h2>
            <p className="text-sm text-content-muted">
              {t("tools.cfoDashboard.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReviewSteps}
              className="rounded-full border border-[color:var(--color-border-default)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-content-primary"
            >
              {t("tools.cfoDashboard.reviewSteps")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCoachOpen(true);
                recordFunnelEvent("personal_cfo_coach_open", {
                  metadata: { surface: "web", trigger: "header" },
                }).catch(() => undefined);
              }}
              className="rounded-full bg-[color:var(--color-brand-primary)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
            >
              {t("tools.cfoDashboard.askCfo")}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label={t("tools.cfoDashboard.kpis.netWorth")}
            primary={fmt(netWorth)}
            secondary={t("tools.cfoDashboard.kpis.netWorthHint", {
              count: data.portfolio.holdings_count,
            })}
          />
          <KpiCard
            label={t("tools.cfoDashboard.kpis.savingsRate")}
            primary={
              savingsRate != null
                ? `${formatNumber(savingsRate, locale, { maximumFractionDigits: 0 })}%`
                : "—"
            }
            secondary={
              hasSpending
                ? t("tools.cfoDashboard.kpis.savingsRateHint", {
                    saved: fmt(data.spending.net_cash_flow),
                  })
                : t("tools.cfoDashboard.kpis.linkBudget")
            }
            tone={
              savingsRate == null
                ? "muted"
                : savingsRate >= 20
                  ? "positive"
                  : savingsRate >= 0
                    ? "neutral"
                    : "negative"
            }
          />
          <KpiCard
            label={t("tools.cfoDashboard.kpis.riskScore")}
            primary={hasPortfolio ? `${riskScore}/100` : "—"}
            secondary={t(
              `tools.cfoDashboard.kpis.diversification.${data.portfolio.diversification}`
            )}
            tone={
              !hasPortfolio
                ? "muted"
                : riskScore >= 70
                  ? "positive"
                  : riskScore >= 40
                    ? "neutral"
                    : "negative"
            }
          />
        </div>
      </header>

      <section className="app-card app-card--pad">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.cfoDashboard.ai.title")}
            </p>
            <h3 className="mt-1 text-base font-semibold text-content-primary">
              {data.ai_analysis.source === "ai"
                ? t("tools.cfoDashboard.ai.sourceLive")
                : t("tools.cfoDashboard.ai.sourceFallback")}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setCoachOpen(true);
              recordFunnelEvent("personal_cfo_coach_open", {
                metadata: { surface: "web", trigger: "ai_card" },
              }).catch(() => undefined);
            }}
            className="rounded-full border border-[color:var(--color-brand-primary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-brand-primary)]"
          >
            {t("tools.cfoDashboard.ai.chat")}
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-content-primary whitespace-pre-line">
          {data.ai_analysis.text}
        </p>
      </section>

      {hasGoals && (
        <section className="app-card app-card--pad">
          <h3 className="text-base font-semibold text-content-primary">
            {t("tools.cfoDashboard.goals.title")}
          </h3>
          <p className="text-xs text-content-muted">
            {t("tools.cfoDashboard.goals.subtitle", {
              done: data.goals_summary.on_track,
              total: data.goals_summary.total,
            })}
          </p>
          <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} fmt={fmt} t={t} />
            ))}
          </div>
        </section>
      )}

      {hasPortfolio && (
        <section className="app-card app-card--pad">
          <h3 className="text-base font-semibold text-content-primary">
            {t("tools.cfoDashboard.portfolio.title")}
          </h3>
          <p className="text-xs text-content-muted">
            {t("tools.cfoDashboard.portfolio.subtitle", {
              total: fmt(data.portfolio.total_value),
              gain: fmt(Math.abs(data.portfolio.total_gain_loss)),
              dir:
                data.portfolio.total_gain_loss >= 0
                  ? t("tools.cfoDashboard.portfolio.up")
                  : t("tools.cfoDashboard.portfolio.down"),
            })}
          </p>
          <div className="mt-4 grid gap-5 grid-cols-1 lg:grid-cols-2">
            <div className="h-56 w-full min-h-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    label={({ name, percent }) =>
                      `${name}: ${formatNumber((percent ?? 0) * 100, locale, {
                        maximumFractionDigits: 1,
                      })}%`
                    }
                  >
                    {allocationData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v || 0), 2)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-muted mb-3">
                {t("tools.cfoDashboard.portfolio.topHoldings")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-content-muted">
                    <tr>
                      <th className="text-left py-1">
                        {t("tools.cfoDashboard.portfolio.cols.symbol")}
                      </th>
                      <th className="text-right py-1">
                        {t("tools.cfoDashboard.portfolio.cols.value")}
                      </th>
                      <th className="text-right py-1">
                        {t("tools.cfoDashboard.portfolio.cols.gain")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.portfolio.top_holdings.map((h) => (
                      <tr
                        key={`${h.symbol}-${h.purchase_date ?? ""}`}
                        className="border-t border-[color:var(--color-border-default)]"
                      >
                        <td className="py-2">
                          <span className="font-semibold text-content-primary">
                            {h.symbol.toUpperCase()}
                          </span>
                          <span className="ml-2 rounded-full bg-[color:var(--color-brand-primary)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--color-brand-primary)]">
                            {h.asset_type}
                          </span>
                        </td>
                        <td className="py-2 text-right">{fmt(h.value)}</td>
                        <td
                          className={`py-2 text-right ${
                            h.gain_loss >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {h.gain_loss >= 0 ? "+" : "-"}
                          {fmt(Math.abs(h.gain_loss))}
                          <span className="ml-1 text-[10px] text-content-muted">
                            (
                            {formatNumber(h.gain_loss_pct, locale, {
                              maximumFractionDigits: 1,
                            })}
                            %)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {hasSpending && (
        <section className="app-card app-card--pad">
          <h3 className="text-base font-semibold text-content-primary">
            {t("tools.cfoDashboard.spending.title")}
          </h3>
          <p className="text-xs text-content-muted">
            {t("tools.cfoDashboard.spending.subtitle", {
              income: fmt(data.spending.income),
              spent: fmt(data.spending.spent),
            })}
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <BarChart
                data={data.spending.by_category.map((row) => ({
                  name: row.label,
                  spent: row.spent,
                  target: row.target ?? 0,
                }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    formatNumber(Number(v), locale, {
                      maximumFractionDigits: 0,
                      notation: "compact",
                    })
                  }
                />
                <Tooltip formatter={(v) => fmt(Number(v || 0))} />
                <Legend />
                <Bar
                  dataKey="spent"
                  name={t("tools.cfoDashboard.spending.spent")}
                  fill="#1d5330"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="target"
                  name={t("tools.cfoDashboard.spending.target")}
                  fill="#9bd1ad"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="app-card app-card--pad">
        <h3 className="text-base font-semibold text-content-primary">
          {t("tools.cfoDashboard.projections.title")}
        </h3>
        <p className="text-xs text-content-muted">
          {t("tools.cfoDashboard.projections.subtitle", {
            start: fmt(data.projections.starting_balance),
            monthly: fmt(data.projections.monthly_contribution),
          })}
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer>
            <LineChart
              data={data.projections.timeline}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="year"
                tickFormatter={(v) =>
                  t("tools.cfoDashboard.projections.yearShort", { year: v })
                }
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  formatNumber(Number(v), locale, {
                    maximumFractionDigits: 0,
                    notation: "compact",
                  })
                }
              />
              <Tooltip formatter={(v) => fmt(Number(v || 0))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="optimistic"
                name={t("tools.cfoDashboard.projections.optimistic")}
                stroke={SCENARIO_COLORS.optimistic}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="moderate"
                name={t("tools.cfoDashboard.projections.moderate")}
                stroke={SCENARIO_COLORS.moderate}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="conservative"
                name={t("tools.cfoDashboard.projections.conservative")}
                stroke={SCENARIO_COLORS.conservative}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.projections.scenarios.map((s) => (
            <ScenarioCard key={s.name} scenario={s} fmt={fmt} t={t} />
          ))}
        </div>
      </section>

      <CFOCoachPanel open={coachOpen} onClose={() => setCoachOpen(false)} />
    </section>
  );
};

type FmtFn = (value: number, fractionDigits?: number) => string;

function KpiCard({
  label,
  primary,
  secondary,
  tone = "neutral",
}: {
  label: string;
  primary: string;
  secondary?: string;
  tone?: "positive" | "negative" | "neutral" | "muted";
}) {
  const toneClasses: Record<typeof tone, string> = {
    positive: "text-emerald-600",
    negative: "text-red-600",
    neutral: "text-content-primary",
    muted: "text-content-muted",
  } as const;
  return (
    <div className="rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${toneClasses[tone]}`}>
        {primary}
      </p>
      {secondary && (
        <p className="mt-1 text-xs text-content-muted">{secondary}</p>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  fmt,
  t,
}: {
  goal: GoalRow;
  fmt: FmtFn;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const pct = Math.min(100, Math.max(0, goal.progress_pct));
  const toneBadge =
    goal.on_track == null
      ? "bg-slate-100 text-slate-600"
      : goal.on_track
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700";
  return (
    <div className="rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-content-primary line-clamp-2">
          {goal.name}
        </p>
        {goal.on_track != null && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneBadge}`}
          >
            {goal.on_track
              ? t("tools.cfoDashboard.goals.onTrack")
              : t("tools.cfoDashboard.goals.behind")}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[color:var(--color-border-default)] overflow-hidden">
        <div
          className="h-full bg-[color:var(--color-brand-primary)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-xs text-content-muted">
        <span>{fmt(goal.current)}</span>
        <span>{fmt(goal.target)}</span>
      </div>
      {goal.projected_date && (
        <p className="mt-2 text-[11px] text-content-muted">
          {t("tools.cfoDashboard.goals.projected", {
            date: goal.projected_date,
          })}
        </p>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  fmt,
  t,
}: {
  scenario: Scenario;
  fmt: FmtFn;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const ten = scenario.horizons.find((h) => h.years === 10);
  return (
    <div className="rounded-2xl border border-[color:var(--color-border-default)] px-4 py-3">
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: SCENARIO_COLORS[scenario.name] }}
      >
        {t(`tools.cfoDashboard.projections.${scenario.name}`)} ·{" "}
        {scenario.annual_rate_pct.toFixed(0)}%
      </p>
      {ten && (
        <>
          <p className="mt-1 text-xl font-bold text-content-primary">
            {fmt(ten.value)}
          </p>
          <p className="text-[11px] text-content-muted">
            {t("tools.cfoDashboard.projections.afterYears", { years: 10 })}
          </p>
        </>
      )}
      <ul className="mt-2 space-y-0.5 text-[11px] text-content-muted">
        {scenario.horizons
          .filter((h) => h.years !== 10)
          .map((h) => (
            <li key={h.years} className="flex justify-between">
              <span>
                {t("tools.cfoDashboard.projections.yearShort", {
                  year: h.years,
                })}
              </span>
              <span className="text-content-primary font-medium">
                {fmt(h.value)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default CFODashboard;
