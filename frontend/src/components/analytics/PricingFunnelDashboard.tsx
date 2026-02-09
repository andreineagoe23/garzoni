import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "contexts/AdminContext";
import { GlassButton, GlassCard } from "components/ui";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import { fetchFunnelMetrics } from "services/analyticsService";
import { queryKeys } from "lib/reactQuery";

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
};

type DailyBreakdownRow = {
  day?: string;
  event_type?: string;
  total?: number;
  visitors?: number;
  started_checkout?: number;
  completed_checkout?: number;
};

const MetricCard = ({ label, value, footer }: MetricCardProps) => (
  <GlassCard padding="lg" className="flex flex-col gap-2">
    <p className="text-sm font-semibold text-[color:var(--muted-text,#6b7280)]">
      {label}
    </p>
    <p className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
      {value}
    </p>
    {footer && (
      <p className="text-xs text-[color:var(--muted-text,#6b7280)]">{footer}</p>
    )}
  </GlassCard>
);

const PricingFunnelDashboard = () => {
  const { t } = useTranslation();
  const { canAdminister } = useAdmin();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.pricingFunnelMetrics(),
    queryFn: async () => {
      const response = await fetchFunnelMetrics();
      return response.data;
    },
  });

  const summary = data?.summary || {};
  const dailyBreakdown = useMemo<DailyBreakdownRow[]>(
    () => data?.daily_breakdown || [],
    [data?.daily_breakdown]
  );

  if (!canAdminister) {
    return (
      <section className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <GlassCard padding="xl" className="space-y-3">
            <h2 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
              {t("analytics.adminRequired")}
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("analytics.adminRequiredDesc")}
            </p>
          </GlassCard>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
              {t("analytics.title")}
            </h1>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("analytics.subtitle")}
            </p>
          </div>
          <GlassButton
            icon={isFetching ? "⏳" : "🔄"}
            onClick={() => refetch()}
            variant="ghost"
          >
            {t("analytics.refresh")}
          </GlassButton>
        </div>

        {isLoading ? (
          <SkeletonGroup>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </SkeletonGroup>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label={t("analytics.pricingViews")}
              value={summary.pricing_views ?? 0}
              footer={t("analytics.pricingViewsFooter")}
            />
            <MetricCard
              label={t("analytics.checkoutsCreated")}
              value={summary.checkouts_created ?? 0}
              footer={t("analytics.conversion", { percent: summary.pricing_to_checkout_rate ?? 0 })}
            />
            <MetricCard
              label={t("analytics.successfulPayments")}
              value={summary.checkouts_completed ?? 0}
              footer={t("analytics.conversion", { percent: summary.checkout_to_paid_rate ?? 0 })}
            />
            <MetricCard
              label={t("analytics.entitlementsConfirmed")}
              value={summary.entitlement_success ?? 0}
              footer={t("analytics.successRate", { percent: summary.entitlement_success_rate ?? 0 })}
            />
            <MetricCard
              label={t("analytics.entitlementFailures")}
              value={summary.entitlement_failures ?? 0}
              footer={t("analytics.fallbackFooter")}
            />
          </div>
        )}

        <GlassCard padding="lg" className="overflow-hidden">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                {t("analytics.dailyFunnelEvents")}
              </h3>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {t("analytics.dailyFunnelSubtitle")}
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : dailyBreakdown.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("analytics.noActivity")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    <th className="px-3 py-2">{t("analytics.date")}</th>
                    <th className="px-3 py-2">{t("analytics.eventType")}</th>
                    <th className="px-3 py-2 text-right">{t("analytics.count")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.map((row) => (
                    <tr
                      key={`${row.event_type ?? "event"}-${row.day ?? "day"}`}
                      className="border-t border-[color:var(--border-color,rgba(0,0,0,0.06))]"
                    >
                      <td className="px-3 py-2 text-sm text-[color:var(--text-color,#111827)]">
                        {row.day ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-[color:var(--muted-text,#6b7280)]">
                        {row.event_type
                          ? row.event_type.replace(/_/g, " ")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-[color:var(--text-color,#111827)]">
                        {row.total ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </section>
  );
};

export default PricingFunnelDashboard;
