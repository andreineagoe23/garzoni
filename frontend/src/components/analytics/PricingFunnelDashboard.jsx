import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "contexts/AdminContext";
import { GlassButton, GlassCard } from "components/ui";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import { fetchFunnelMetrics } from "services/analyticsService";
import { queryKeys } from "lib/reactQuery";

const MetricCard = ({ label, value, footer }) => (
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
  const { canAdminister } = useAdmin();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.pricingFunnelMetrics(),
    queryFn: async () => {
      const response = await fetchFunnelMetrics();
      return response.data;
    },
  });

  const summary = data?.summary || {};
  const dailyBreakdown = useMemo(
    () => data?.daily_breakdown || [],
    [data?.daily_breakdown]
  );

  if (!canAdminister) {
    return (
      <section className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <GlassCard padding="xl" className="space-y-3">
            <h2 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
              Admin access required
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Conversion analytics are only available to administrators.
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
              Pricing & Checkout Funnel
            </h1>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Monitor how users move from the pricing page to successful checkout
              and entitlement activation.
            </p>
          </div>
          <GlassButton
            icon={isFetching ? "⏳" : "🔄"}
            onClick={() => refetch()}
            variant="ghost"
          >
            Refresh
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
              label="Pricing views"
              value={summary.pricing_views ?? 0}
              footer="Users reaching the pricing or paywall experience"
            />
            <MetricCard
              label="Checkout sessions created"
              value={summary.checkouts_created ?? 0}
              footer={`Conversion: ${summary.pricing_to_checkout_rate ?? 0}%`}
            />
            <MetricCard
              label="Successful payments"
              value={summary.checkouts_completed ?? 0}
              footer={`Conversion: ${summary.checkout_to_paid_rate ?? 0}%`}
            />
            <MetricCard
              label="Entitlements confirmed"
              value={summary.entitlement_success ?? 0}
              footer={`Success rate: ${summary.entitlement_success_rate ?? 0}%`}
            />
            <MetricCard
              label="Entitlement failures"
              value={summary.entitlement_failures ?? 0}
              footer="Fallback to free mode when checks fail"
            />
          </div>
        )}

        <GlassCard padding="lg" className="overflow-hidden">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                Daily funnel events
              </h3>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                Volume of key funnel events over time.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : dailyBreakdown.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              No funnel activity recorded for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Event type</th>
                    <th className="px-3 py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.map((row) => (
                    <tr key={`${row.event_type}-${row.day}`} className="border-t border-[color:var(--border-color,rgba(0,0,0,0.06))]">
                      <td className="px-3 py-2 text-sm text-[color:var(--text-color,#111827)]">
                        {row.day}
                      </td>
                      <td className="px-3 py-2 text-sm text-[color:var(--muted-text,#6b7280)]">
                        {row.event_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-[color:var(--text-color,#111827)]">
                        {row.total}
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

