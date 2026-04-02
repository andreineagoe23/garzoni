import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { GlassButton, GlassCard, Modal } from "components/ui";
import apiClient from "services/httpClient";
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
  trial_days?: number | null;
  features?: Record<string, PlanFeature>;
};

const SubscriptionManager = () => {
  const { t } = useTranslation();
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelPeriodEnd, setCancelPeriodEnd] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"yearly" | "monthly">(
    "yearly"
  );
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
        const response = await apiClient.get("/plans/");
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

  const planCards = useMemo(() => {
    const starter = sortedPlans.find((p) => p.plan_id === "starter");
    const plus = sortedPlans.find(
      (p) => p.plan_id === "plus" && p.billing_interval === billingInterval
    );
    const pro = sortedPlans.find(
      (p) => p.plan_id === "pro" && p.billing_interval === billingInterval
    );
    const out: Plan[] = [];
    if (starter) out.push(starter);
    if (plus) out.push(plus);
    if (pro) out.push(pro);
    return out;
  }, [sortedPlans, billingInterval]);

  const currentPlanId = entitlements?.plan || "starter";
  const trialEndLabel = entitlements?.trialEnd
    ? formatDate(entitlements.trialEnd, locale)
    : null;
  const portalEligible = ["active", "trialing"].includes(
    entitlements?.status ?? ""
  );

  // When user is paid/trialing but may lack stripe_subscription_id, try to sync from Stripe (e.g. by email)
  useEffect(() => {
    if (!portalEligible) return;
    const syncSubscription = async () => {
      try {
        const res = await apiClient.post<{ ok: boolean }>(
          "/subscriptions/sync/",
          {}
        );
        if (res.data?.ok && loadProfile) {
          const profilePayload = await loadProfile({ force: true });
          const userData = profilePayload?.user_data || profilePayload || {};
          setStripeSubscriptionId(
            (profilePayload as { stripe_subscription_id?: string | null })
              ?.stripe_subscription_id ??
              (userData as { stripe_subscription_id?: string | null })
                ?.stripe_subscription_id ??
              null
          );
          reloadEntitlements?.();
        }
      } catch {
        // Ignore; sync is best-effort
      }
    };
    syncSubscription();
  }, [portalEligible, loadProfile, reloadEntitlements]);

  const handleStartCheckout = async (
    planId: string,
    billingInterval: string
  ) => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      const response = await apiClient.post("/subscriptions/create/", {
        plan_id: planId,
        billing_interval: billingInterval,
      });
      const redirectUrl = response.data?.redirect_url;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      setActionError(t("billing.failedCheckout"));
    } catch (error) {
      setActionError(getErrorMessage(error, t("billing.failedCheckout")));
    } finally {
      setIsBusy(false);
    }
  };

  const handleChangePlan = async (planId: string, billingInterval: string) => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      await apiClient.post("/subscriptions/change/", {
        plan_id: planId,
        billing_interval: billingInterval,
      });
      await reloadEntitlements?.();
    } catch (error) {
      setActionError(getErrorMessage(error, t("billing.failedChangePlan")));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelClick = () => {
    setActionError("");
    setShowCancelConfirm(true);
  };

  const handleCancelConfirm = async () => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      const response = await apiClient.post("/subscriptions/cancel/", {});
      const periodEnd = response.data?.current_period_end;
      if (periodEnd) {
        setCancelPeriodEnd(formatDate(periodEnd, locale));
      } else {
        setCancelPeriodEnd("");
      }
      setShowCancelConfirm(false);
      await reloadEntitlements?.();
    } catch (error) {
      setActionError(getErrorMessage(error, t("billing.failedCancel")));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!isAuthenticated) return;
    setActionError("");
    setIsBusy(true);
    try {
      const response = await apiClient.post("/subscriptions/portal/", {});
      const portalUrl = response.data?.url;
      if (portalUrl) {
        window.location.assign(portalUrl);
        return;
      }
      setActionError(t("billing.failedPortal"));
    } catch (error) {
      setActionError(getErrorMessage(error, t("billing.failedPortal")));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-var(--top-nav-height,72px))] w-full max-w-5xl flex-col gap-6 bg-[color:var(--bg-color,#f8fafc)] px-4 py-12 text-[color:var(--text-color,#111827)]">
      <GlassCard padding="lg" className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-color,#111827)]">
            {t("billing.subscriptionManagement")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("billing.manageSubtitle")}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--card-bg,#ffffff)]/80 px-4 py-3 text-sm text-[color:var(--text-color,#111827)]">
          <div className="font-semibold">
            {t("billing.currentPlan")}:{" "}
            {entitlements?.label ||
              currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1)}
          </div>
          <div>
            {t("billing.status")}: {entitlements?.status || "inactive"}
          </div>
          {entitlements?.status === "trialing" && trialEndLabel && (
            <div>{t("billing.trialEndsOn", { date: trialEndLabel })}</div>
          )}
          {cancelPeriodEnd !== null && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {cancelPeriodEnd
                ? t("billing.cancelSuccess", { date: cancelPeriodEnd })
                : t("billing.cancelSuccessNoDate")}
            </div>
          )}
        </div>
      </GlassCard>

      <Modal
        isOpen={showCancelConfirm}
        title={
          entitlements?.status === "trialing"
            ? t("billing.cancelConfirmTitleTrial")
            : t("billing.cancelConfirmTitleActive")
        }
        onClose={() => setShowCancelConfirm(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-white/80">
            {entitlements?.status === "trialing"
              ? t("billing.cancelConfirmTrial", {
                  date: trialEndLabel || "",
                })
              : t("billing.cancelConfirmActiveShort")}
          </p>
          <div className="flex flex-wrap gap-3">
            <GlassButton
              variant="ghost"
              onClick={() => setShowCancelConfirm(false)}
              disabled={isBusy}
            >
              {entitlements?.status === "trialing"
                ? t("billing.keepTrial")
                : t("billing.keepSubscription")}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={handleCancelConfirm}
              disabled={isBusy}
            >
              {entitlements?.status === "trialing"
                ? t("billing.cancelTrial")
                : t("billing.cancelSubscription")}
            </GlassButton>
          </div>
        </div>
      </Modal>

      <GlassCard padding="lg" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--text-color,#111827)]">
            {t("billing.availablePlans")}
          </h2>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("billing.choosePlanSubtitle")}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            className="inline-flex rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60 p-1"
            role="group"
            aria-label={t("subscriptions.choosePlan")}
          >
            <button
              type="button"
              onClick={() => setBillingInterval("yearly")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                billingInterval === "yearly"
                  ? "bg-[color:var(--primary,#1d5330)] text-white shadow-sm"
                  : "text-[color:var(--muted-text,#6b7280)] hover:text-[color:var(--text-color,#111827)]"
              }`}
            >
              {t("subscriptions.billingYearly")}
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                billingInterval === "monthly"
                  ? "bg-[color:var(--primary,#1d5330)] text-white shadow-sm"
                  : "text-[color:var(--muted-text,#6b7280)] hover:text-[color:var(--text-color,#111827)]"
              }`}
            >
              {t("subscriptions.billingMonthly")}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("billing.loadingPlans")}
          </p>
        )}
        {!loading && (
          <div className="grid gap-4 md:grid-cols-3">
            {planCards.map((plan) => {
              const features = Object.values(plan.features || {})
                .map((f) => f?.description || f?.name)
                .filter(Boolean);
              const isStarter =
                plan.plan_id === "starter" ||
                Number(plan.price_amount || 0) === 0;
              const isHighlight = plan.plan_id === "plus";
              const trialLabel = plan.trial_days
                ? t("subscriptions.trialDays", { count: plan.trial_days })
                : null;
              const name =
                plan.name ||
                plan.plan_id.charAt(0).toUpperCase() + plan.plan_id.slice(1);
              const paidPlan = !isStarter;
              const billingLabel = plan.billing_interval || "monthly";
              const isCurrent = plan.plan_id === currentPlanId;
              const canChange = Boolean(stripeSubscriptionId);
              const buttonLabel = isCurrent
                ? t("billing.currentPlanButton")
                : canChange
                  ? t("billing.switchPlan")
                  : t("billing.startPlan");
              return (
                <div
                  key={`${plan.plan_id}-${billingLabel}`}
                  className={`flex flex-col gap-4 rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-5 text-left shadow-sm ${
                    isHighlight
                      ? "border-[color:var(--primary,#1d5330)] shadow-lg shadow-[color:var(--accent,#ffd700)]/20"
                      : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
                        {name}
                      </div>
                      {isCurrent && (
                        <span className="rounded-full bg-[color:var(--primary,#1d5330)]/10 px-2 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)]">
                          {t("billing.active")}
                        </span>
                      )}
                      {isStarter && !isCurrent && (
                        <span className="rounded-full bg-[color:var(--success,#16a34a)]/15 px-2 py-1 text-xs font-semibold text-[color:var(--success,#16a34a)]">
                          {t("subscriptions.free")}
                        </span>
                      )}
                      {trialLabel && paidPlan && !isCurrent && (
                        <span className="rounded-full bg-[color:var(--primary,#1d5330)]/10 px-2 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)]">
                          {trialLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-3xl font-extrabold text-[color:var(--text-color,#0f172a)]">
                      {formatCurrency(
                        Number(plan.price_amount || 0),
                        plan.currency || "USD",
                        locale,
                        { minimumFractionDigits: 0 }
                      )}
                      <span className="ml-1 text-xs font-medium text-[color:var(--muted-text,#6b7280)]">
                        {` / ${billingLabel === "monthly" ? t("subscriptions.perMonth") : billingLabel === "yearly" ? t("subscriptions.perYear") : billingLabel}`}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-[color:var(--text-color,#111827)]">
                    {(features.length
                      ? features
                      : [t("subscriptions.premiumLearningAccess")]
                    ).map((fe) => (
                      <li key={fe}>• {fe}</li>
                    ))}
                  </ul>
                  <GlassButton
                    variant={
                      isCurrent ? "ghost" : isHighlight ? "primary" : "ghost"
                    }
                    className="w-full"
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
                </div>
              );
            })}
          </div>
        )}
        {portalEligible && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {cancelPeriodEnd === null && (
              <GlassButton
                variant="ghost"
                onClick={handleCancelClick}
                disabled={isBusy}
              >
                {entitlements?.status === "trialing"
                  ? t("billing.cancelTrial")
                  : t("billing.cancelSubscription")}
              </GlassButton>
            )}
            <GlassButton
              variant="primary"
              onClick={handleOpenPortal}
              disabled={isBusy}
            >
              {t("billing.manageSubscription")}
            </GlassButton>
          </div>
        )}
        {!portalEligible && (
          <GlassButton
            variant="primary"
            onClick={() => window.location.assign("/subscriptions")}
          >
            {t("billing.explorePlans")}
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
