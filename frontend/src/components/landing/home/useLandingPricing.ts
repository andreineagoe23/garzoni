import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSubscriptionPlans, queryKeys } from "@garzoni/core";

type CatalogPlan = {
  plan_id: string;
  billing_interval: string;
  price_amount?: number | string;
  currency?: string;
};

export type TierPricing = {
  monthly: number;
  yearly: number;
  currency: string;
  savingsPct: number;
};

// Used only when the /plans/ catalog can't be read. Kept in sync with
// backend/authentication/entitlements.py.
const FALLBACK: Record<"plus" | "pro", TierPricing> = {
  plus: { monthly: 6.99, yearly: 59.99, currency: "GBP", savingsPct: 28 },
  pro: { monthly: 7.99, yearly: 69.99, currency: "GBP", savingsPct: 27 },
};

const savingsPct = (monthly: number, yearly: number) => {
  const pct = Math.round((1 - yearly / (monthly * 12)) * 100);
  return pct > 0 ? pct : 0;
};

function tier(planId: "plus" | "pro", plans: CatalogPlan[]): TierPricing {
  const monthly = plans.find(
    (p) => p.plan_id === planId && p.billing_interval === "monthly"
  );
  const yearly = plans.find(
    (p) => p.plan_id === planId && p.billing_interval === "yearly"
  );
  const monthlyPrice = Number(monthly?.price_amount ?? NaN);
  const yearlyPrice = Number(yearly?.price_amount ?? NaN);
  if (!Number.isFinite(monthlyPrice) || !Number.isFinite(yearlyPrice))
    return FALLBACK[planId];
  return {
    monthly: monthlyPrice,
    yearly: yearlyPrice,
    currency: monthly?.currency || yearly?.currency || "GBP",
    savingsPct: savingsPct(monthlyPrice, yearlyPrice),
  };
}

/**
 * Live Plus and Pro prices from the public catalog. Promo prices are left out on
 * purpose: they are store-side introductory offers, claimable only in the app.
 */
export function useLandingPricing() {
  const { data } = useQuery({
    queryKey: queryKeys.subscriptionPlans(),
    queryFn: () => fetchSubscriptionPlans().then((res) => res.data),
    staleTime: 10 * 60_000,
  });

  return useMemo(() => {
    const plans = (data?.plans ?? []) as CatalogPlan[];
    return { plus: tier("plus", plans), pro: tier("pro", plans) };
  }, [data]);
}
