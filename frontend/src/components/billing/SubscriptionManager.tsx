import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { GlassButton, GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";
import { useAuth } from "contexts/AuthContext";
import { formatCurrency, formatDate, getLocale } from "utils/format";

type PlanFeature = {
  name?: string;
  description?: string;
  enabled?: boolean;
};

type Plan = {
  plan_id: string;
  name?: string;
  billing_interval?: string;
  price_amount?: number | string;
  currency?: string;
  sort_order?: number | null;
  features?: Record<string, PlanFeature>;
};

const SubscriptionManager = () => {
  const {
    entitlements,
    getAccessToken,
    isAuthenticated,
    reloadEntitlements,
    loadProfile,
  } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<
    string | null
  >(null);
  const locale = getLocale();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      return (
        error.response?.data?.error || error.response?.data?.detail || fallback
      );
    }
    return fallback;
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/plans/`);
        const apiPlans = response.data?.plans || [];
        setPlans(apiPlans);
      } catch (error) {
        console.warn("Failed to load plans:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profilePayload = await loadProfile?.({ force: true });
        const userData = profilePayload?.user_data || profilePayload || {};
        setStripeSubscriptionId(
          (profilePayload as { stripe_subscription_id?: string | null })
            ?.stripe_subscription_id ??
            (userData as { stripe_subscription_id?: string | null })
              ?.stripe_subscription_id ??
            null
        );
      } catch (error) {
        console.warn("Failed to load profile for billing page:", error);
      }
    };
    fetchProfile();
  }, [loadProfile]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [plans]);
  const currentPlanId = entitlements?.plan || "free";
  const trialEndLabel = entitlements?.trialEnd
    ? formatDate(entitlements.trialEnd, locale)
    : null;
  const portalEligible = ["active", "trialing"].includes(
    entitlements?.status ?? ""
  );

  const handleStartCheckout = async (
    planId: string,
    billingInterval: string
  ) => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/subscriptions/create/`,
        { plan_id: planId, billing_interval: billingInterval },
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      const redirectUrl = response.data?.redirect_url;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      setActionError("Failed to start checkout. Please try again.");
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to start checkout. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleChangePlan = async (planId: string, billingInterval: string) => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      await axios.post(
        `${BACKEND_URL}/subscriptions/change/`,
        { plan_id: planId, billing_interval: billingInterval },
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      await reloadEntitlements?.();
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to change plan. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      await axios.post(
        `${BACKEND_URL}/subscriptions/cancel/`,
        {},
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      await reloadEntitlements?.();
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to cancel subscription. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/subscriptions/portal/`,
        {},
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      const portalUrl = response.data?.url;
      if (portalUrl) {
        window.location.assign(portalUrl);
        return;
      }
      setActionError("Failed to open customer portal. Please try again.");
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to open customer portal. Please try again."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-var(--top-nav-height,72px))] w-full max-w-5xl flex-col gap-6 bg-[color:var(--bg-color,#f8fafc)] px-4 py-12 text-[color:var(--text-color,#111827)]">
      <GlassCard padding="lg" className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
            Subscription Management
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Manage your subscription and billing
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--card-bg,#ffffff)]/80 px-4 py-3 text-sm text-[color:var(--text-color,#111827)]">
          <div className="font-semibold">
            Current Plan: {entitlements?.label || currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1)}
          </div>
          <div>
            Status: {entitlements?.status || "inactive"}
          </div>
          {entitlements?.status === "trialing" && trialEndLabel && (
            <div>Trial ends on {trialEndLabel}</div>
          )}
        </div>
      </GlassCard>

      <GlassCard padding="lg" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
            Available Plans
          </h2>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Choose a plan that fits your learning needs
          </p>
        </div>
        {loading && (
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Loading plans...
          </p>
        )}
        {!loading && (
          <div className="grid gap-4 md:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isCurrent = plan.plan_id === currentPlanId;
              const canChange = Boolean(stripeSubscriptionId);
              const billingLabel = plan.billing_interval || "monthly";
              const buttonLabel = isCurrent
                ? "Current Plan"
                : canChange
                  ? "Switch Plan"
                  : "Start Plan";
              const translatedName = plan.name || plan.plan_id.charAt(0).toUpperCase() + plan.plan_id.slice(1);
              const featureList = Object.values(plan.features || {})
                .filter((feature) => feature?.enabled !== false)
                .map((feature) => feature?.description || feature?.name)
                .filter(Boolean);
              return (
                <GlassCard
                  key={`${plan.plan_id}-${billingLabel}`}
                  padding="md"
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                      {translatedName}
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-2 py-1 text-xs font-semibold text-[color:var(--primary,#2563eb)]">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
                    {formatCurrency(
                      Number(plan.price_amount || 0),
                      plan.currency || "USD",
                      locale,
                      { minimumFractionDigits: 0 }
                    )}{" "}
                    / {billingLabel === 'monthly' ? 'month' : billingLabel === 'yearly' ? 'year' : billingLabel}
                  </div>
                  {featureList.length > 0 && (
                    <ul className="space-y-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                      {featureList.map((feature) => (
                        <li key={feature}>• {feature}</li>
                      ))}
                    </ul>
                  )}
                  <GlassButton
                    className="w-full"
                    variant={isCurrent ? "ghost" : "primary"}
                    disabled={isBusy || isCurrent}
                    onClick={() => {
                      if (isCurrent) return;
                      if (canChange) {
                        handleChangePlan(plan.plan_id, billingLabel);
                      } else {
                        handleStartCheckout(plan.plan_id, billingLabel);
                      }
                    }}
                  >
                    {buttonLabel}
                  </GlassButton>
                </GlassCard>
              );
            })}
          </div>
        )}
        {portalEligible && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <GlassButton
              variant="ghost"
              onClick={handleCancel}
              disabled={isBusy}
            >
              Cancel Subscription
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleOpenPortal}
              disabled={isBusy}
            >
              Manage Subscription
            </GlassButton>
          </div>
        )}
        {!portalEligible && (
          <GlassButton
            variant="primary"
            onClick={() => window.location.assign("/subscriptions")}
          >
            Explore Plans
          </GlassButton>
        )}
        {actionError && (
          <p className="text-sm text-[color:var(--error,#dc2626)]">
            {actionError}
          </p>
        )}
      </GlassCard>
    </section>
  );
};

export default SubscriptionManager;
