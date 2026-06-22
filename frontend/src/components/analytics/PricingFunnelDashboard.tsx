import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useAdmin } from "contexts/AdminContext";
import { GlassButton, GlassCard } from "components/ui";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import { fetchFunnelMetrics } from "services/analyticsService";
import { queryKeys } from "lib/reactQuery";

type Platform = "all" | "web" | "mobile";

type FunnelSummary = {
  pricing_views?: number;
  checkouts_created?: number;
  checkouts_completed?: number;
  entitlement_success?: number;
  entitlement_failures?: number;
  pricing_to_checkout_rate?: number;
  checkout_to_paid_rate?: number;
  entitlement_success_rate?: number;
};

type PlatformRow = FunnelSummary & {
  events?: number;
  active_users?: number;
};

type MetricsResponse = {
  platform?: Platform;
  days?: number;
  active_users?: {
    last_1d?: number;
    last_7d?: number;
    last_30d?: number;
    in_range?: number;
  };
  users?: {
    total?: number;
    new_last_1d?: number;
    new_last_7d?: number;
    new_last_30d?: number;
    new_in_range?: number;
    new_by_platform?: Record<string, number>;
  };
  signups_timeseries?: { day: string; signups: number }[];
  totals?: { events?: number; sessions?: number; signed_in_users?: number };
  summary?: FunnelSummary;
  top_features?: { event_type: string; count: number; users?: number }[];
  top_clicks?: { event_type: string; count: number }[];
  top_plans?: { plan: string; count: number }[];
  revenue?: {
    by_currency?: { currency: string; total: number; payments: number }[];
    payments?: number;
  };
  revenue_timeseries?: { day: string; total: number; payments: number }[];
  timeseries?: {
    day: string;
    events: number;
    active_users: number;
    pricing_views: number;
    checkouts_completed: number;
  }[];
  by_platform?: Record<string, PlatformRow>;
};

const RANGES = [
  { days: 1, key: "24h" },
  { days: 7, key: "7d" },
  { days: 30, key: "30d" },
  { days: 90, key: "90d" },
] as const;

const PLATFORMS: { value: Platform; labelKey: string; fallback: string }[] = [
  { value: "all", labelKey: "analytics.platformAll", fallback: "All" },
  { value: "web", labelKey: "analytics.platformWeb", fallback: "Web" },
  {
    value: "mobile",
    labelKey: "analytics.platformMobile",
    fallback: "Mobile (iOS + Android)",
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  ios: "iOS",
  android: "Android",
  unknown: "Server / unknown",
};

const COLORS = {
  users: "#1d5330",
  usersFill: "#9bd1ad",
  events: "#3b82f6",
  revenue: "#f59e0b",
  bar: "#1d5330",
};

/** "tool_open" → "Tool open". */
const humanize = (raw: string) =>
  raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const nfmt = (n: number | undefined) => (n ?? 0).toLocaleString();

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  accent?: string;
};

const MetricCard = ({ label, value, footer, accent }: MetricCardProps) => (
  <GlassCard padding="lg" className="flex flex-col gap-1">
    <p className="text-sm font-semibold text-content-muted">{label}</p>
    <p
      className="text-3xl font-bold text-content-primary"
      style={accent ? { color: accent } : undefined}
    >
      {value}
    </p>
    {footer && <p className="text-xs text-content-muted">{footer}</p>}
  </GlassCard>
);

const ChartCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <GlassCard padding="lg" className="flex flex-col gap-3">
    <div>
      <h3 className="text-lg font-semibold text-content-primary">{title}</h3>
      {subtitle && <p className="text-sm text-content-muted">{subtitle}</p>}
    </div>
    {children}
  </GlassCard>
);

const SegmentedControl = <T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className="inline-flex flex-wrap gap-1 rounded-full border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)]/60 p-1"
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            active
              ? "bg-[color:var(--color-brand-primary)] text-white shadow-sm"
              : "text-content-muted hover:text-content-primary"
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

const PricingFunnelDashboard = () => {
  const { t } = useTranslation();
  const { canAdminister } = useAdmin();
  const [platform, setPlatform] = useState<Platform>("all");
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, refetch, isFetching } = useQuery<MetricsResponse>({
    queryKey: queryKeys.pricingFunnelMetrics(platform, days),
    enabled: canAdminister,
    queryFn: async () => {
      const response = await fetchFunnelMetrics({ platform, days });
      return response.data;
    },
  });

  const summary = data?.summary || {};
  const active = data?.active_users || {};
  const users = data?.users || {};
  const totals = data?.totals || {};
  const signupSeries = useMemo(
    () => data?.signups_timeseries || [],
    [data?.signups_timeseries]
  );
  const timeseries = useMemo(() => data?.timeseries || [], [data?.timeseries]);
  const revenueSeries = useMemo(
    () => data?.revenue_timeseries || [],
    [data?.revenue_timeseries]
  );
  const topFeatures = useMemo(
    () =>
      (data?.top_features || []).map((r) => ({
        name: humanize(r.event_type),
        count: r.count,
      })),
    [data?.top_features]
  );
  const topClicks = useMemo(
    () =>
      (data?.top_clicks || []).map((r) => ({
        name: humanize(r.event_type.replace(/_click$/, "")),
        count: r.count,
      })),
    [data?.top_clicks]
  );
  const topPlans = data?.top_plans || [];
  const revenueByCurrency = useMemo(
    () => data?.revenue?.by_currency || [],
    [data?.revenue?.by_currency]
  );
  const platformRows = useMemo(() => {
    const map = data?.by_platform || {};
    const order = ["web", "ios", "android", "unknown"];
    return Object.entries(map).sort(
      ([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
    );
  }, [data?.by_platform]);

  const revenueLabel = useMemo(() => {
    if (revenueByCurrency.length === 0) return "—";
    return revenueByCurrency
      .map((r) => `${r.total.toLocaleString()} ${r.currency}`)
      .join(" · ");
  }, [revenueByCurrency]);

  if (!canAdminister) {
    return (
      <section className="min-h-screen bg-surface-page px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <GlassCard padding="xl" className="space-y-3">
            <h2 className="text-xl font-bold text-content-primary">
              {t("analytics.adminRequired")}
            </h2>
            <p className="text-sm text-content-muted">
              {t("analytics.adminRequiredDesc")}
            </p>
          </GlassCard>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-surface-page px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-content-primary">
              {t("analytics.title")}
            </h1>
            <p className="text-sm text-content-muted">
              {t("analytics.subtitle")}
            </p>
          </div>
          <GlassButton
            icon={
              <GarzoniIcon name={isFetching ? "hourglass" : "sync"} size={16} />
            }
            onClick={() => refetch()}
            variant="ghost"
          >
            {t("analytics.refresh")}
          </GlassButton>
        </div>

        {/* Controls: platform + range */}
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl<Platform>
            ariaLabel={t("analytics.platform")}
            value={platform}
            onChange={setPlatform}
            options={PLATFORMS.map((p) => ({
              value: p.value,
              label: t(p.labelKey),
            }))}
          />
          <SegmentedControl<number>
            ariaLabel={t("analytics.range")}
            value={days}
            onChange={setDays}
            options={RANGES.map((r) => ({
              value: r.days,
              label: t(`analytics.range_${r.key}`),
            }))}
          />
        </div>

        {/* New accounts (ground truth from the User table) */}
        {isLoading ? (
          <SkeletonGroup>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </SkeletonGroup>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={t("analytics.totalUsers")}
              value={nfmt(users.total)}
              footer={t("analytics.totalUsersFooter")}
            />
            <MetricCard
              label={t("analytics.newLast24h")}
              value={nfmt(users.new_last_1d)}
              accent={COLORS.users}
            />
            <MetricCard
              label={t("analytics.newLast7d")}
              value={nfmt(users.new_last_7d)}
              accent={COLORS.users}
            />
            <MetricCard
              label={t("analytics.newLast30d")}
              value={nfmt(users.new_last_30d)}
              accent={COLORS.users}
            />
          </div>
        )}

        {/* New signups over time */}
        {!isLoading && signupSeries.length > 0 && (
          <ChartCard
            title={t("analytics.signupsOverTime")}
            subtitle={t("analytics.signupsOverTimeSub")}
          >
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart
                  data={signupSeries}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="signups"
                    name={t("analytics.signups")}
                    fill={COLORS.users}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {/* Active users (engagement, event-derived) */}
        {isLoading ? (
          <SkeletonGroup>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </SkeletonGroup>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label={t("analytics.activeLast24h")}
              value={nfmt(active.last_1d)}
              accent={COLORS.users}
            />
            <MetricCard
              label={t("analytics.activeLast7d")}
              value={nfmt(active.last_7d)}
              accent={COLORS.users}
            />
            <MetricCard
              label={t("analytics.activeLast30d")}
              value={nfmt(active.last_30d)}
              accent={COLORS.users}
            />
            <MetricCard
              label={t("analytics.revenue")}
              value={revenueLabel}
              footer={t("analytics.revenueScope")}
              accent={COLORS.revenue}
            />
          </div>
        )}

        {/* Engagement totals */}
        {!isLoading && (
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label={t("analytics.totalEvents")}
              value={nfmt(totals.events)}
            />
            <MetricCard
              label={t("analytics.sessions")}
              value={nfmt(totals.sessions)}
            />
            <MetricCard
              label={t("analytics.signedInUsers")}
              value={nfmt(totals.signed_in_users)}
            />
          </div>
        )}

        {/* Active users + events over time */}
        {!isLoading && (
          <ChartCard
            title={t("analytics.usersOverTime")}
            subtitle={t("analytics.usersOverTimeSub")}
          >
            {timeseries.length === 0 ? (
              <p className="text-sm text-content-muted">
                {t("analytics.noActivity")}
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart
                    data={timeseries}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={COLORS.usersFill}
                          stopOpacity={0.7}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.usersFill}
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="active_users"
                      name={t("analytics.activeUsers")}
                      stroke={COLORS.users}
                      fill="url(#gUsers)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      name={t("analytics.events")}
                      stroke={COLORS.events}
                      fillOpacity={0}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        )}

        {/* Funnel */}
        {!isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label={t("analytics.pricingViews")}
              value={nfmt(summary.pricing_views)}
              footer={t("analytics.pricingViewsFooter")}
            />
            <MetricCard
              label={t("analytics.checkoutsCreated")}
              value={nfmt(summary.checkouts_created)}
              footer={t("analytics.conversion", {
                percent: summary.pricing_to_checkout_rate ?? 0,
              })}
            />
            <MetricCard
              label={t("analytics.successfulPayments")}
              value={nfmt(summary.checkouts_completed)}
              footer={t("analytics.conversion", {
                percent: summary.checkout_to_paid_rate ?? 0,
              })}
            />
          </div>
        )}

        {/* Revenue over time */}
        {!isLoading && revenueSeries.length > 0 && (
          <ChartCard
            title={t("analytics.revenueOverTime")}
            subtitle={t("analytics.revenueScope")}
          >
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart
                  data={revenueSeries}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name={t("analytics.revenue")}
                    stroke={COLORS.revenue}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        {/* Top features + clicks */}
        {!isLoading && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title={t("analytics.topFeatures")}
              subtitle={t("analytics.topFeaturesSub")}
            >
              {topFeatures.length === 0 ? (
                <p className="text-sm text-content-muted">
                  {t("analytics.noActivity")}
                </p>
              ) : (
                <div style={{ height: Math.max(160, topFeatures.length * 34) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={topFeatures}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={150}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name={t("analytics.count")}
                        fill={COLORS.bar}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <ChartCard
              title={t("analytics.topClicks")}
              subtitle={t("analytics.topClicksSub")}
            >
              {topClicks.length === 0 ? (
                <p className="text-sm text-content-muted">
                  {t("analytics.noActivity")}
                </p>
              ) : (
                <div style={{ height: Math.max(160, topClicks.length * 34) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={topClicks}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={150}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name={t("analytics.count")}
                        fill={COLORS.events}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>
        )}

        {/* What they're spending on (plans) */}
        {!isLoading && topPlans.length > 0 && (
          <ChartCard
            title={t("analytics.topPlans")}
            subtitle={t("analytics.topPlansSub")}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-content-muted">
                    <th className="px-3 py-2">{t("analytics.plan")}</th>
                    <th className="px-3 py-2 text-right">
                      {t("analytics.checkoutsCreated")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topPlans.map((p) => (
                    <tr
                      key={p.plan}
                      className="border-t border-[color:var(--color-border-default)]"
                    >
                      <td className="px-3 py-2 text-sm text-content-primary">
                        {humanize(p.plan)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-content-primary">
                        {nfmt(p.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}

        {/* Platform comparison (always all platforms) */}
        {!isLoading && platformRows.length > 0 && (
          <ChartCard
            title={t("analytics.platformSplit")}
            subtitle={t("analytics.platformSplitSubtitle")}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-content-muted">
                    <th className="px-3 py-2">{t("analytics.platform")}</th>
                    <th className="px-3 py-2 text-right">
                      {t("analytics.activeUsers")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("analytics.events")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("analytics.pricingViews")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("analytics.successfulPayments")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map(([key, row]) => (
                    <tr
                      key={key}
                      className="border-t border-[color:var(--color-border-default)]"
                    >
                      <td className="px-3 py-2 text-sm font-semibold text-content-primary">
                        {PLATFORM_LABELS[key] ?? humanize(key)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-content-primary">
                        {nfmt(row.active_users)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-content-primary">
                        {nfmt(row.events)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-content-primary">
                        {nfmt(row.pricing_views)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-content-primary">
                        {nfmt(row.checkouts_completed)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}
      </div>
    </section>
  );
};

export default PricingFunnelDashboard;
