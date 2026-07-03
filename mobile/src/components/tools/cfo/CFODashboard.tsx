import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { apiClient } from "@garzoni/core";
import { useThemeColors } from "../../../theme/ThemeContext";
import { radius, spacing, typography } from "../../../theme/tokens";
import { logDevError } from "../../../lib/logDevError";

const PALETTE = [
  "#1d5330",
  "#2a7347",
  "#6db389",
  "#9bd1ad",
  "#c2e8ce",
  "#b45309",
  "#fbbf24",
  "#3b82f6",
];

type AllocationRow = { asset_type: string; value: number; share_pct: number };
type Holding = {
  symbol: string;
  asset_type: string;
  value: number;
  gain_loss: number;
  gain_loss_pct: number;
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
type SpendingCat = {
  category: string;
  label: string;
  spent: number;
  target: number | null;
  over_budget: boolean;
};
type Scenario = {
  name: "conservative" | "moderate" | "optimistic";
  annual_rate_pct: number;
  horizons: { years: number; value: number; gain: number }[];
};
type TimelinePoint = {
  year: number;
  conservative: number;
  moderate: number;
  optimistic: number;
};

export type CFODashboardPayload = {
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
    by_category: SpendingCat[];
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

function formatCurrency(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value)}`;
  }
}

function formatCurrencyPrecise(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

type Props = {
  onReviewSteps: () => void;
  onOpenCoach: () => void;
};

export default function CFODashboard({ onReviewSteps, onOpenCoach }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const [data, setData] = useState<CFODashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (apiClient as any).get(
        "/personal-cfo/dashboard/?surface=mobile",
      );
      setData(res.data as CFODashboardPayload);
    } catch (err: any) {
      logDevError("tools/personal-cfo/dashboard", err);
      if (err?.response?.status === 402) {
        setError(t("tools.cfoDashboard.errors.upgradeRequired"));
      } else {
        setError(t("tools.cfoDashboard.errors.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // The dashboard returns instantly with a deterministic narrative and
  // status "pending" while the AI text is generated in the background —
  // poll the lightweight narrative endpoint until it flips to "ready".
  const narrativePending = data?.ai_analysis?.status === "pending";
  useEffect(() => {
    if (!narrativePending) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 15) {
        clearInterval(timer);
        return;
      }
      void (apiClient as any)
        .get("/personal-cfo/narrative/?surface=mobile")
        .then(
          (res: {
            data: { text: string; source: string; status: string };
          }) => {
            if (res.data?.status === "ready") {
              clearInterval(timer);
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      ai_analysis:
                        res.data as CFODashboardPayload["ai_analysis"],
                    }
                  : prev,
              );
            }
          },
        )
        .catch(() => clearInterval(timer));
    }, 3000);
    return () => clearInterval(timer);
  }, [narrativePending]);

  if (loading) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <ActivityIndicator color={c.primary} />
        <Text
          style={[styles.muted, { color: c.textMuted, marginTop: spacing.sm }]}
        >
          {t("tools.cfoDashboard.loading")}
        </Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View
        style={[
          styles.card,
          { borderColor: c.border, backgroundColor: c.surface },
        ]}
      >
        <Text style={[styles.muted, { color: c.textMuted }]}>
          {error || t("tools.cfoDashboard.errors.loadFailed")}
        </Text>
        <Pressable
          onPress={() => void load()}
          style={({ pressed }) => [
            styles.retryBtn,
            { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.retryText, { color: c.text }]}>
            {t("tools.cfoDashboard.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <DashboardHeader
        data={data}
        onReviewSteps={onReviewSteps}
        onOpenCoach={onOpenCoach}
      />
      <AICard data={data} onOpenCoach={onOpenCoach} />
      {data.goals.length > 0 && <GoalsSection data={data} />}
      {data.portfolio.holdings_count > 0 && <PortfolioSection data={data} />}
      {data.spending.available && data.spending.income > 0 && (
        <SpendingSection data={data} />
      )}
      <ProjectionsSection data={data} />
    </View>
  );
}

function DashboardHeader({
  data,
  onReviewSteps,
  onOpenCoach,
}: {
  data: CFODashboardPayload;
  onReviewSteps: () => void;
  onOpenCoach: () => void;
}) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const savings = data.spending.savings_rate_pct;
  const risk = data.portfolio.risk_score;
  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
    >
      <Text style={[styles.eyebrow, { color: c.textMuted }]}>
        {t("tools.cfoDashboard.eyebrow").toUpperCase()}
      </Text>
      <Text style={[styles.title, { color: c.text }]}>
        {t("tools.cfoDashboard.title")}
      </Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        {t("tools.cfoDashboard.subtitle")}
      </Text>

      <View style={styles.kpiRow}>
        <Kpi
          label={t("tools.cfoDashboard.kpis.netWorth")}
          primary={formatCurrency(data.net_worth.total, data.currency)}
          tone="neutral"
        />
        <Kpi
          label={t("tools.cfoDashboard.kpis.savingsRate")}
          primary={savings != null ? `${Math.round(savings)}%` : "—"}
          tone={
            savings == null
              ? "muted"
              : savings >= 20
                ? "positive"
                : savings >= 0
                  ? "neutral"
                  : "negative"
          }
        />
        <Kpi
          label={t("tools.cfoDashboard.kpis.riskScore")}
          primary={data.portfolio.holdings_count > 0 ? `${risk}` : "—"}
          tone={
            data.portfolio.holdings_count === 0
              ? "muted"
              : risk >= 70
                ? "positive"
                : risk >= 40
                  ? "neutral"
                  : "negative"
          }
        />
      </View>

      <View style={styles.headerActions}>
        <Pressable
          onPress={onReviewSteps}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.secondaryBtnText, { color: c.text }]}>
            {t("tools.cfoDashboard.reviewSteps")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenCoach}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {t("tools.cfoDashboard.askCfo")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Kpi({
  label,
  primary,
  tone,
}: {
  label: string;
  primary: string;
  tone: "positive" | "negative" | "neutral" | "muted";
}) {
  const c = useThemeColors();
  const color =
    tone === "positive"
      ? c.success
      : tone === "negative"
        ? c.error
        : tone === "muted"
          ? c.textMuted
          : c.text;
  return (
    <View style={[styles.kpi, { borderColor: c.border }]}>
      <Text style={[styles.kpiLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.kpiPrimary, { color }]} numberOfLines={1}>
        {primary}
      </Text>
    </View>
  );
}

function AICard({
  data,
  onOpenCoach,
}: {
  data: CFODashboardPayload;
  onOpenCoach: () => void;
}) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
    >
      <View style={styles.aiHeaderRow}>
        <View>
          <Text style={[styles.sectionEyebrow, { color: c.textMuted }]}>
            {t("tools.cfoDashboard.ai.title").toUpperCase()}
          </Text>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {data.ai_analysis.source === "ai"
              ? t("tools.cfoDashboard.ai.sourceLive")
              : t("tools.cfoDashboard.ai.sourceFallback")}
          </Text>
        </View>
        <Pressable
          onPress={onOpenCoach}
          style={({ pressed }) => [
            styles.chip,
            { borderColor: c.primary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.chipText, { color: c.primary }]}>
            {t("tools.cfoDashboard.ai.chat").toUpperCase()}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.aiBody, { color: c.text }]}>
        {data.ai_analysis.text}
      </Text>
    </View>
  );
}

function GoalsSection({ data }: { data: CFODashboardPayload }) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("tools.cfoDashboard.goals.title")}
      </Text>
      <Text style={[styles.muted, { color: c.textMuted }]}>
        {t("tools.cfoDashboard.goals.subtitle", {
          done: data.goals_summary.on_track,
          total: data.goals_summary.total,
        })}
      </Text>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {data.goals.map((g) => {
          const pct = Math.min(100, Math.max(0, g.progress_pct));
          return (
            <View key={g.id} style={styles.goalRow}>
              <View style={styles.goalHeader}>
                <Text
                  style={[styles.goalName, { color: c.text }]}
                  numberOfLines={2}
                >
                  {g.name}
                </Text>
                {g.on_track != null && (
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: g.on_track
                          ? c.success + "22"
                          : "#b4530922",
                        borderColor: "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: g.on_track ? c.success : "#b45309" },
                      ]}
                    >
                      {g.on_track
                        ? t("tools.cfoDashboard.goals.onTrack").toUpperCase()
                        : t("tools.cfoDashboard.goals.behind").toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.goalTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.goalFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: c.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.goalFooter}>
                <Text style={[styles.muted, { color: c.textMuted }]}>
                  {formatCurrency(g.current, data.currency)} /{" "}
                  {formatCurrency(g.target, data.currency)}
                </Text>
                {g.projected_date && (
                  <Text style={[styles.muted, { color: c.textMuted }]}>
                    {t("tools.cfoDashboard.goals.projected", {
                      date: g.projected_date,
                    })}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PortfolioSection({ data }: { data: CFODashboardPayload }) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const total = data.portfolio.total_value;
  const slices = useMemo(() => {
    if (total <= 0) return [];
    return data.portfolio.allocation.map((row, idx) => ({
      ...row,
      color: PALETTE[idx % PALETTE.length],
    }));
  }, [data, total]);

  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("tools.cfoDashboard.portfolio.title")}
      </Text>
      <Text style={[styles.muted, { color: c.textMuted }]}>
        {t("tools.cfoDashboard.portfolio.subtitle", {
          total: formatCurrency(total, data.currency),
          gain: formatCurrency(
            Math.abs(data.portfolio.total_gain_loss),
            data.currency,
          ),
          dir:
            data.portfolio.total_gain_loss >= 0
              ? t("tools.cfoDashboard.portfolio.up")
              : t("tools.cfoDashboard.portfolio.down"),
        })}
      </Text>

      <View style={styles.chartContainer}>
        <View style={styles.donutWrap}>
          <Donut slices={slices} size={132} />
          <View style={styles.donutCenter} pointerEvents="none">
            <Text style={[styles.donutCenterLabel, { color: c.textMuted }]}>
              {data.portfolio.holdings_count === 1
                ? "1 holding"
                : `${data.portfolio.holdings_count} holdings`}
            </Text>
          </View>
        </View>
        <View style={styles.legendCol}>
          {slices.map((s) => (
            <View key={s.asset_type} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: c.text }]}>
                {t(`tools.portfolio.assetType.${s.asset_type}`, {
                  defaultValue: s.asset_type,
                })}
                <Text style={[styles.legendValue, { color: c.textMuted }]}>
                  {`  ${s.share_pct.toFixed(0)}%`}
                </Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
        <Text style={[styles.sectionEyebrow, { color: c.textMuted }]}>
          {t("tools.cfoDashboard.portfolio.topHoldings").toUpperCase()}
        </Text>
        {data.portfolio.top_holdings.map((h) => (
          <View key={`${h.symbol}-${h.asset_type}`} style={styles.holdingRow}>
            <Text
              style={[styles.holdingSymbol, { color: c.text }]}
              numberOfLines={1}
            >
              {h.symbol.toUpperCase()}
            </Text>
            <Text style={[styles.holdingValue, { color: c.text }]}>
              {formatCurrencyPrecise(h.value, data.currency)}
            </Text>
            <Text
              style={[
                styles.holdingGain,
                { color: h.gain_loss >= 0 ? c.success : c.error },
              ]}
            >
              {h.gain_loss >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(h.gain_loss), data.currency)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Donut({
  slices,
  size,
}: {
  slices: {
    asset_type: string;
    color: string;
    share_pct: number;
  }[];
  size: number;
}) {
  const c = useThemeColors();
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;
  const ringWidth = outerR - innerR;
  const ringR = (outerR + innerR) / 2;

  if (slices.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: c.border,
        }}
      />
    );
  }

  // Single 100% slice — render full ring. (SVG arcs cannot draw 360° in one path.)
  if (slices.length === 1) {
    return (
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={ringR}
          fill="none"
          stroke={slices[0].color}
          strokeWidth={ringWidth}
        />
      </Svg>
    );
  }

  // Multi-slice: annular sector paths.
  function polar(r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function sectorPath(startDeg: number, endDeg: number) {
    const endClamped = Math.min(endDeg, startDeg + 359.99);
    const p1Outer = polar(outerR, startDeg);
    const p2Outer = polar(outerR, endClamped);
    const p2Inner = polar(innerR, endClamped);
    const p1Inner = polar(innerR, startDeg);
    const large = endClamped - startDeg > 180 ? 1 : 0;
    return [
      `M ${p1Outer.x} ${p1Outer.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${p2Outer.x} ${p2Outer.y}`,
      `L ${p2Inner.x} ${p2Inner.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${p1Inner.x} ${p1Inner.y}`,
      "Z",
    ].join(" ");
  }

  let angle = 0;
  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => {
        const sweep = (s.share_pct / 100) * 360;
        const start = angle;
        const end = angle + sweep;
        angle = end;
        return (
          <Path
            key={s.asset_type + i}
            d={sectorPath(start, end)}
            fill={s.color}
            stroke={c.surface}
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
}

function SpendingSection({ data }: { data: CFODashboardPayload }) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const rows = data.spending.by_category.slice(0, 6);
  const maxVal = Math.max(
    1,
    ...rows.map((r) => Math.max(r.spent, r.target ?? 0)),
  );
  const chartWidth = 320;
  const barAreaWidth = chartWidth - 110;
  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("tools.cfoDashboard.spending.title")}
      </Text>
      <Text style={[styles.muted, { color: c.textMuted }]}>
        {t("tools.cfoDashboard.spending.subtitle", {
          income: formatCurrency(data.spending.income, data.currency),
          spent: formatCurrency(data.spending.spent, data.currency),
        })}
      </Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {rows.map((row) => {
          const spent = Math.max(0, row.spent);
          const target = row.target ?? 0;
          const spentWidth = (spent / maxVal) * barAreaWidth;
          const targetWidth = target > 0 ? (target / maxVal) * barAreaWidth : 0;
          return (
            <View key={row.category}>
              <View style={styles.spendRow}>
                <Text
                  style={[styles.spendLabel, { color: c.text }]}
                  numberOfLines={1}
                >
                  {row.label}
                </Text>
                <Text
                  style={[
                    styles.spendValue,
                    { color: row.over_budget ? c.error : c.text },
                  ]}
                >
                  {formatCurrency(spent, data.currency)}
                </Text>
              </View>
              <View
                style={[
                  styles.spendBarTrack,
                  { backgroundColor: c.border, width: barAreaWidth },
                ]}
              >
                <View
                  style={[
                    styles.spendBarFill,
                    {
                      width: spentWidth,
                      backgroundColor: row.over_budget ? c.error : c.primary,
                    },
                  ]}
                />
                {targetWidth > 0 && (
                  <View
                    style={[
                      styles.spendTargetMarker,
                      { left: targetWidth - 1, backgroundColor: c.text },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProjectionsSection({ data }: { data: CFODashboardPayload }) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const W = 320;
  const H = 160;
  const padding = 24;
  const points = data.projections.timeline;
  if (points.length === 0) return null;
  const maxValue = Math.max(
    1,
    ...points.flatMap((p) => [p.conservative, p.moderate, p.optimistic]),
  );
  const xStep = (W - padding * 2) / Math.max(1, points.length - 1);
  function projectPoints(key: "conservative" | "moderate" | "optimistic") {
    return points
      .map((p, i) => {
        const x = padding + i * xStep;
        const y = H - padding - (p[key] / maxValue) * (H - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }
  const colorMap: Record<"conservative" | "moderate" | "optimistic", string> = {
    conservative: "#9bd1ad",
    moderate: "#2a7347",
    optimistic: "#1d5330",
  };
  return (
    <View
      style={[
        styles.card,
        { borderColor: c.border, backgroundColor: c.surface },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("tools.cfoDashboard.projections.title")}
      </Text>
      <Text style={[styles.muted, { color: c.textMuted }]}>
        {t("tools.cfoDashboard.projections.subtitle", {
          start: formatCurrency(
            data.projections.starting_balance,
            data.currency,
          ),
          monthly: formatCurrency(
            data.projections.monthly_contribution,
            data.currency,
          ),
        })}
      </Text>
      <View style={{ marginTop: spacing.md, alignItems: "center" }}>
        <Svg width={W} height={H}>
          <Rect x={0} y={0} width={W} height={H} fill="transparent" />
          <Line
            x1={padding}
            y1={H - padding}
            x2={W - padding}
            y2={H - padding}
            stroke={c.border}
            strokeWidth={1}
          />
          <Line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={H - padding}
            stroke={c.border}
            strokeWidth={1}
          />
          {(["conservative", "moderate", "optimistic"] as const).map((key) => (
            <Polyline
              key={key}
              points={projectPoints(key)}
              fill="none"
              stroke={colorMap[key]}
              strokeWidth={2}
            />
          ))}
        </Svg>
      </View>
      <View style={styles.scenarioRow}>
        {data.projections.scenarios.map((s) => {
          const ten = s.horizons.find((h) => h.years === 10);
          return (
            <View
              key={s.name}
              style={[styles.scenarioBox, { borderColor: c.border }]}
            >
              <Text style={[styles.scenarioLabel, { color: colorMap[s.name] }]}>
                {t(`tools.cfoDashboard.projections.${s.name}`).toUpperCase()} ·{" "}
                {s.annual_rate_pct.toFixed(0)}%
              </Text>
              {ten && (
                <Text style={[styles.scenarioValue, { color: c.text }]}>
                  {formatCurrency(ten.value, data.currency)}
                </Text>
              )}
              <Text
                style={[styles.muted, { color: c.textMuted, fontSize: 10 }]}
              >
                {t("tools.cfoDashboard.projections.afterYears", { years: 10 })}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  center: { alignItems: "center", justifyContent: "center" },
  muted: { fontSize: typography.xs, lineHeight: 18 },
  eyebrow: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: { fontSize: typography.xl, fontWeight: "800" },
  subtitle: { fontSize: typography.sm, lineHeight: 20 },
  sectionEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  sectionTitle: { fontSize: typography.md, fontWeight: "700" },
  kpiRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  kpi: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  kpiLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  kpiPrimary: { fontSize: typography.lg, fontWeight: "800" },
  headerActions: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: typography.sm,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: typography.sm, fontWeight: "700" },
  retryBtn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  retryText: { fontSize: typography.sm, fontWeight: "700" },
  aiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  aiBody: { fontSize: typography.sm, lineHeight: 22, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  goalRow: { gap: 4 },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  goalName: { flex: 1, fontSize: typography.sm, fontWeight: "700" },
  goalTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  goalFill: { height: 6, borderRadius: 3 },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  donutWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  } as any,
  donutCenterLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  legendCol: { flex: 1, gap: 4 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: typography.xs },
  legendValue: { fontSize: typography.xs },
  holdingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: spacing.sm,
  },
  holdingSymbol: { flex: 1, fontSize: typography.sm, fontWeight: "700" },
  holdingValue: { fontSize: typography.sm, minWidth: 80, textAlign: "right" },
  holdingGain: {
    fontSize: typography.xs,
    fontWeight: "700",
    minWidth: 70,
    textAlign: "right",
  },
  spendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  spendLabel: { flex: 1, fontSize: typography.sm },
  spendValue: { fontSize: typography.sm, fontWeight: "700" },
  spendBarTrack: {
    position: "relative",
    height: 8,
    borderRadius: 4,
    overflow: "visible",
  },
  spendBarFill: {
    height: 8,
    borderRadius: 4,
  },
  spendTargetMarker: {
    position: "absolute",
    top: -3,
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  scenarioRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  scenarioBox: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 2,
  },
  scenarioLabel: { fontSize: 10, fontWeight: "800" },
  scenarioValue: { fontSize: typography.md, fontWeight: "800" },
});
