import React, { useMemo, useState } from "react";
import PageContainer from "components/common/PageContainer";
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
import FormNotice from "components/common/FormNotice";
import AnalyticsMetricTile from "components/analytics/AnalyticsMetricTile";
import AnalyticsSegmentedControl from "components/analytics/AnalyticsSegmentedControl";
import { useChartPalette } from "components/analytics/useChartPalette";
import { fetchFunnelMetrics } from "services/analyticsService";
import { queryKeys } from "lib/reactQuery";

type Platform = "all" | "web" | "mobile";
type Tab = "growth" | "learning" | "subscriptions";

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

type OnboardingFunnel = {
  signups?: number;
  questionnaire_started?: number;
  onboarding_completed?: number;
  signup_to_started_rate?: number;
  started_to_completed_rate?: number;
  signup_to_completed_rate?: number;
};

type ActivationMetrics = {
  signups_in_range?: number;
  activated?: number;
  activation_rate?: number;
  activated_within_1d?: number;
  activated_within_7d?: number;
  median_days_to_first_lesson?: number | null;
};

type SubscriptionMix = {
  total_profiles?: number;
  premium?: number;
  has_paid?: number;
  premium_rate?: number;
  by_plan?: Record<string, number>;
  by_status?: Record<string, number>;
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
  lesson_funnel?: {
    lessons_started?: number;
    lessons_completed?: number;
    sections_completed?: number;
    learners_started?: number;
    learners_completed?: number;
    completion_rate?: number;
    top_lessons?: {
      lesson_id: string | null;
      starts: number;
      learners: number;
    }[];
  };
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
  onboarding_funnel?: OnboardingFunnel;
  onboarding_timeseries?: { day: string; completions: number }[];
  activation?: ActivationMetrics;
  subscription_mix?: SubscriptionMix;
  streak_distribution?: { bucket: string; count: number }[];
  at_risk?: { count?: number; description?: string };
  engagement_by_plan?: {
    plan: string;
    users: number;
    avg_streak: number;
    total_earned_money: number;
  }[];
  learning_timeseries?: { day: string; learners: number }[];
};

const RANGES = [
  { days: 1, key: "24h" },
  { days: 7, key: "7d" },
  { days: 30, key: "30d" },
  { days: 90, key: "90d" },
] as const;

const TABS: { value: Tab; labelKey: string }[] = [
  { value: "growth", labelKey: "analytics.tabGrowth" },
  { value: "learning", labelKey: "analytics.tabLearning" },
  { value: "subscriptions", labelKey: "analytics.tabSubscriptions" },
];

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
  server: "Server (backend events)",
  // Legacy rows logged before platform attribution was added.
  unknown: "Server / unknown",
};

const humanize = (raw: string) =>
  raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const nfmt = (n: number | undefined) => (n ?? 0).toLocaleString();

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

const KeyValueTable = ({
  rows,
  nameLabel,
  valueLabel,
}: {
  rows: [string, number][];
  nameLabel: string;
  valueLabel: string;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[320px] text-left">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-content-muted">
          <th className="px-3 py-2">{nameLabel}</th>
          <th className="px-3 py-2 text-right">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, count]) => (
          <tr key={key} className="border-t border-border">
            <td className="px-3 py-2 text-sm text-content-primary">
              {humanize(key)}
            </td>
            <td className="px-3 py-2 text-right text-sm font-semibold text-content-primary">
              {nfmt(count)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PricingFunnelDashboard = () => {
  const { t } = useTranslation();
  const { canAdminister } = useAdmin();
  const palette = useChartPalette();
  const [platform, setPlatform] = useState<Platform>("all");
  const [days, setDays] = useState<number>(30);
  const [tab, setTab] = useState<Tab>("growth");

  const { data, isLoading, isError, refetch, isFetching } =
    useQuery<MetricsResponse>({
      queryKey: queryKeys.pricingFunnelMetrics(platform, days),
      enabled: canAdminister,
      queryFn: async () => {
        const response = await fetchFunnelMetrics({ platform, days });
        return response.data;
      },
    });

  const summary = data?.summary ?? {};
  const active = data?.active_users ?? {};
  const users = data?.users ?? {};
  const totals = data?.totals ?? {};

  const signupSeries = useMemo(
    () => data?.signups_timeseries || [],
    [data?.signups_timeseries]
  );
  const timeseries = useMemo(() => data?.timeseries || [], [data?.timeseries]);
  const revenueSeries = useMemo(
    () => data?.revenue_timeseries || [],
    [data?.revenue_timeseries]
  );
  const onboardingSeries = useMemo(
    () => data?.onboarding_timeseries || [],
    [data?.onboarding_timeseries]
  );
  const learningSeries = useMemo(
    () => data?.learning_timeseries || [],
    [data?.learning_timeseries]
  );
  const streakSeries = useMemo(
    () => data?.streak_distribution || [],
    [data?.streak_distribution]
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
  const engagementByPlan = data?.engagement_by_plan || [];
  const revenueByCurrency = useMemo(
    () => data?.revenue?.by_currency || [],
    [data?.revenue?.by_currency]
  );
  const platformRows = useMemo(() => {
    const map = data?.by_platform || {};
    const order = ["web", "ios", "android", "server", "unknown"];
    return Object.entries(map).sort(
      ([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
    );
  }, [data?.by_platform]);

  const onboardingFunnelChart = useMemo(() => {
    const funnel = data?.onboarding_funnel;
    return [
      { stage: t("analytics.funnelSignups"), count: funnel?.signups ?? 0 },
      {
        stage: t("analytics.funnelStarted"),
        count: funnel?.questionnaire_started ?? 0,
      },
      {
        stage: t("analytics.funnelCompleted"),
        count: funnel?.onboarding_completed ?? 0,
      },
    ];
  }, [data?.onboarding_funnel, t]);

  const planRows = useMemo(
    () =>
      Object.entries(data?.subscription_mix?.by_plan ?? {}).sort(
        (a, b) => b[1] - a[1]
      ),
    [data?.subscription_mix?.by_plan]
  );
  const statusRows = useMemo(
    () =>
      Object.entries(data?.subscription_mix?.by_status ?? {}).sort(
        (a, b) => b[1] - a[1]
      ),
    [data?.subscription_mix?.by_status]
  );

  const revenueLabel = useMemo(() => {
    if (revenueByCurrency.length === 0) return "—";
    return revenueByCurrency
      .map((r) => `${r.total.toLocaleString()} ${r.currency}`)
      .join(" · ");
  }, [revenueByCurrency]);

  if (!canAdminister) {
    return (
      <PageContainer maxWidth="4xl" innerClassName="text-center">
        <GlassCard padding="xl" className="space-y-3">
          <h2 className="text-xl font-bold text-content-primary">
            {t("analytics.adminRequired")}
          </h2>
          <p className="text-sm text-content-muted">
            {t("analytics.adminRequiredDesc")}
          </p>
        </GlassCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="app-display text-2xl text-content-primary">
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

      {isError && <FormNotice>{t("analytics.loadError")}</FormNotice>}

      <div className="flex flex-wrap items-center gap-3">
        <AnalyticsSegmentedControl<Tab>
          ariaLabel={t("analytics.title")}
          value={tab}
          onChange={setTab}
          options={TABS.map((item) => ({
            value: item.value,
            label: t(item.labelKey),
          }))}
        />
        <AnalyticsSegmentedControl<Platform>
          ariaLabel={t("analytics.platform")}
          value={platform}
          onChange={setPlatform}
          options={PLATFORMS.map((p) => ({
            value: p.value,
            label: t(p.labelKey),
          }))}
        />
        <AnalyticsSegmentedControl<number>
          ariaLabel={t("analytics.range")}
          value={days}
          onChange={setDays}
          options={RANGES.map((r) => ({
            value: r.days,
            label: t(`analytics.range_${r.key}`),
          }))}
        />
      </div>

      {tab === "growth" && !isError && (
        <>
          {isLoading ? (
            <SkeletonGroup>
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </SkeletonGroup>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AnalyticsMetricTile
                label={t("analytics.totalUsers")}
                value={nfmt(users.total)}
                footer={t("analytics.totalUsersFooter")}
              />
              <AnalyticsMetricTile
                label={t("analytics.newLast24h")}
                value={nfmt(users.new_last_1d)}
                tone="brand"
              />
              <AnalyticsMetricTile
                label={t("analytics.newLast7d")}
                value={nfmt(users.new_last_7d)}
                tone="brand"
              />
              <AnalyticsMetricTile
                label={t("analytics.newLast30d")}
                value={nfmt(users.new_last_30d)}
                tone="brand"
              />
            </div>
          )}

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
                      fill={palette.brand}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {!isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AnalyticsMetricTile
                label={t("analytics.activeLast24h")}
                value={nfmt(active.last_1d)}
                tone="brand"
              />
              <AnalyticsMetricTile
                label={t("analytics.activeLast7d")}
                value={nfmt(active.last_7d)}
                tone="brand"
              />
              <AnalyticsMetricTile
                label={t("analytics.activeLast30d")}
                value={nfmt(active.last_30d)}
                tone="brand"
              />
              <AnalyticsMetricTile
                label={t("analytics.revenue")}
                value={revenueLabel}
                footer={t("analytics.revenueScope")}
                tone="warning"
              />
            </div>
          )}

          {!isLoading && (
            <div className="grid gap-4 sm:grid-cols-3">
              <AnalyticsMetricTile
                label={t("analytics.totalEvents")}
                value={nfmt(totals.events)}
              />
              <AnalyticsMetricTile
                label={t("analytics.sessions")}
                value={nfmt(totals.sessions)}
              />
              <AnalyticsMetricTile
                label={t("analytics.signedInUsers")}
                value={nfmt(totals.signed_in_users)}
              />
            </div>
          )}

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
                            stopColor={palette.brandSoft}
                            stopOpacity={0.7}
                          />
                          <stop
                            offset="95%"
                            stopColor={palette.brandSoft}
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
                        stroke={palette.brand}
                        fill="url(#gUsers)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="events"
                        name={t("analytics.events")}
                        stroke={palette.info}
                        fillOpacity={0}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          )}

          {!isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnalyticsMetricTile
                label={t("analytics.pricingViews")}
                value={nfmt(summary.pricing_views)}
                footer={t("analytics.pricingViewsFooter")}
              />
              <AnalyticsMetricTile
                label={t("analytics.checkoutsCreated")}
                value={nfmt(summary.checkouts_created)}
                footer={t("analytics.conversion", {
                  percent: summary.pricing_to_checkout_rate ?? 0,
                })}
              />
              <AnalyticsMetricTile
                label={t("analytics.successfulPayments")}
                value={nfmt(summary.checkouts_completed)}
                footer={t("analytics.conversion", {
                  percent: summary.checkout_to_paid_rate ?? 0,
                })}
              />
            </div>
          )}

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
                      stroke={palette.warning}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

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
                  <div
                    style={{ height: Math.max(160, topFeatures.length * 34) }}
                  >
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
                          fill={palette.brand}
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
                          fill={palette.info}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>
          )}

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
                      <tr key={p.plan} className="border-t border-border">
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
                      <tr key={key} className="border-t border-border">
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
        </>
      )}

      {tab === "learning" && !isLoading && !isError && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticsMetricTile
              label={t("analytics.funnelCompleted")}
              value={nfmt(data?.onboarding_funnel?.onboarding_completed)}
              footer={t("analytics.conversion", {
                percent: data?.onboarding_funnel?.signup_to_completed_rate ?? 0,
              })}
            />
            <AnalyticsMetricTile
              label={t("analytics.activatedUsers")}
              value={nfmt(data?.activation?.activated)}
              footer={t("analytics.activationRateSub")}
              tone="accent"
            />
            <AnalyticsMetricTile
              label={t("analytics.activationRate")}
              value={`${data?.activation?.activation_rate ?? 0}%`}
              tone="accent"
            />
            <AnalyticsMetricTile
              label={t("analytics.atRiskUsers")}
              value={nfmt(data?.at_risk?.count)}
              footer={data?.at_risk?.description}
              tone="error"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticsMetricTile
              label={t("analytics.lessonsStarted")}
              value={nfmt(data?.lesson_funnel?.lessons_started)}
              footer={t("analytics.lessonLearnersStarted", {
                count: data?.lesson_funnel?.learners_started ?? 0,
              })}
              tone="accent"
            />
            <AnalyticsMetricTile
              label={t("analytics.lessonsCompleted")}
              value={nfmt(data?.lesson_funnel?.lessons_completed)}
              footer={t("analytics.lessonLearnersCompleted", {
                count: data?.lesson_funnel?.learners_completed ?? 0,
              })}
              tone="accent"
            />
            <AnalyticsMetricTile
              label={t("analytics.lessonCompletionRate")}
              value={`${data?.lesson_funnel?.completion_rate ?? 0}%`}
              footer={t("analytics.lessonCompletionRateSub")}
            />
            <AnalyticsMetricTile
              label={t("analytics.sectionsCompleted")}
              value={nfmt(data?.lesson_funnel?.sections_completed)}
            />
          </div>

          {(data?.lesson_funnel?.top_lessons?.length ?? 0) > 0 && (
            <ChartCard
              title={t("analytics.topLessons")}
              subtitle={t("analytics.topLessonsSub")}
            >
              <ul className="divide-y divide-border/40">
                {data?.lesson_funnel?.top_lessons?.map((l) => (
                  <li
                    key={l.lesson_id ?? "unknown"}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {t("analytics.lessonLabel", "Lesson")} #
                      {l.lesson_id ?? "?"}
                    </span>
                    <span className="font-medium">
                      {nfmt(l.starts)} {t("analytics.starts", "starts")} ·{" "}
                      {nfmt(l.learners)} {t("analytics.learners", "learners")}
                    </span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          )}

          <ChartCard
            title={t("analytics.onboardingFunnel")}
            subtitle={t("analytics.onboardingFunnelSub")}
          >
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart
                  data={onboardingFunnelChart}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name={t("analytics.count")}
                    fill={palette.brand}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {onboardingSeries.length > 0 && (
            <ChartCard
              title={t("analytics.onboardingOverTime")}
              subtitle={t("analytics.onboardingOverTimeSub")}
            >
              <div className="h-60">
                <ResponsiveContainer>
                  <LineChart data={onboardingSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="completions"
                      name={t("analytics.completions")}
                      stroke={palette.brand}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <AnalyticsMetricTile
              label={t("analytics.medianDaysToLesson")}
              value={
                data?.activation?.median_days_to_first_lesson != null
                  ? data.activation.median_days_to_first_lesson
                  : "—"
              }
            />
            <AnalyticsMetricTile
              label={t("analytics.activatedWithin1d")}
              value={nfmt(data?.activation?.activated_within_1d)}
            />
            <AnalyticsMetricTile
              label={t("analytics.activatedWithin7d")}
              value={nfmt(data?.activation?.activated_within_7d)}
            />
          </div>

          <ChartCard
            title={t("analytics.streakDistribution")}
            subtitle={t("analytics.streakDistributionSub")}
          >
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={streakSeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name={t("analytics.usersCount")}
                    fill={palette.accent}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard
            title={t("analytics.learningOverTime")}
            subtitle={t("analytics.learningOverTimeSub")}
          >
            {learningSeries.length === 0 ? (
              <p className="text-sm text-content-muted">
                {t("analytics.noActivity")}
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={learningSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="learners"
                      name={t("analytics.learners")}
                      stroke={palette.accent}
                      fill={palette.accent}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </>
      )}

      {tab === "subscriptions" && !isLoading && !isError && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnalyticsMetricTile
              label={t("analytics.premiumAccounts")}
              value={nfmt(data?.subscription_mix?.premium)}
              tone="warning"
            />
            <AnalyticsMetricTile
              label={t("analytics.paidAccounts")}
              value={nfmt(data?.subscription_mix?.has_paid)}
            />
            <AnalyticsMetricTile
              label={t("analytics.premiumRate")}
              value={`${data?.subscription_mix?.premium_rate ?? 0}%`}
            />
            <AnalyticsMetricTile
              label={t("analytics.totalUsers")}
              value={nfmt(data?.subscription_mix?.total_profiles)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title={t("analytics.planBreakdown")}
              subtitle={t("analytics.subscriptionMixSub")}
            >
              {planRows.length === 0 ? (
                <p className="text-sm text-content-muted">
                  {t("analytics.noActivity")}
                </p>
              ) : (
                <KeyValueTable
                  rows={planRows}
                  nameLabel={t("analytics.plan")}
                  valueLabel={t("analytics.usersCount")}
                />
              )}
            </ChartCard>

            <ChartCard
              title={t("analytics.statusBreakdown")}
              subtitle={t("analytics.subscriptionMixSub")}
            >
              {statusRows.length === 0 ? (
                <p className="text-sm text-content-muted">
                  {t("analytics.noActivity")}
                </p>
              ) : (
                <KeyValueTable
                  rows={statusRows}
                  nameLabel={t("analytics.statusLabel")}
                  valueLabel={t("analytics.usersCount")}
                />
              )}
            </ChartCard>
          </div>

          {engagementByPlan.length > 0 && (
            <ChartCard
              title={t("analytics.engagementByPlan")}
              subtitle={t("analytics.engagementByPlanSub")}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-content-muted">
                      <th className="px-3 py-2">{t("analytics.plan")}</th>
                      <th className="px-3 py-2 text-right">
                        {t("analytics.usersCount")}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t("analytics.avgStreak")}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t("analytics.totalEarned")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagementByPlan.map((row) => (
                      <tr key={row.plan} className="border-t border-border">
                        <td className="px-3 py-2 text-sm text-content-primary">
                          {humanize(row.plan)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-content-primary">
                          {nfmt(row.users)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-content-primary">
                          {row.avg_streak}
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-content-primary">
                          {row.total_earned_money.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}

      {(tab === "learning" || tab === "subscriptions") && isLoading && (
        <SkeletonGroup>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </SkeletonGroup>
      )}
    </PageContainer>
  );
};

export default PricingFunnelDashboard;
