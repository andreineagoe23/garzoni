/**
 * Subscriptions / plans page. Rendered at /subscriptions.
 * Imported statically in App so it stays in the main bundle (avoids chunk resolution issues).
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
import { recordFunnelEvent } from "services/analyticsService";
import { BACKEND_URL } from "services/backendUrl";
import { fetchQuestionnaireProgress } from "services/questionnaireService";
import { formatCurrency, formatDate, getLocale } from "utils/format";

type PlanFeature = {
  name?: string;
  description?: string;
  enabled?: boolean;
  daily_quota?: number | null;
};

type Plan = {
  plan_id: string;
  name?: string;
  billing_interval: string;
  price_amount?: number | string;
  currency?: string;
  trial_days?: number | null;
  sort_order?: number | null;
  features?: Record<string, PlanFeature>;
};

const formatFeatureValue = (feature: PlanFeature | undefined) => {
  if (!feature || feature.enabled === false) return "Not Included";
  if (feature.daily_quota === null || feature.daily_quota === undefined) return "Unlimited";
  if (typeof feature.daily_quota === "number") return `${feature.daily_quota} / day`;
  return "Included";
};

const SubscriptionPlansPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    entitlements,
    entitlementError,
    entitlementSupportLink,
    reloadEntitlements,
    loadProfile,
    isAuthenticated,
    getAccessToken,
  } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    hasPaid: false,
  });
  const [selectionError, setSelectionError] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const locale = getLocale();

  const { data: questionnaireProgress } = useQuery({
    queryKey: ["questionnaire-progress"],
    queryFn: fetchQuestionnaireProgress,
    enabled: isAuthenticated ?? false,
    staleTime: 0,
  });
  const questionnaireComplete = questionnaireProgress?.status === "completed";

  const trialEndLabel = useMemo(
    () => (entitlements?.trialEnd ? formatDate(entitlements.trialEnd, locale) : null),
    [entitlements?.trialEnd, locale]
  );

  const fetchSubscriptionInfo = useCallback(async () => {
    try {
      const profilePayload = await loadProfile?.({ force: true });
      const userData = profilePayload?.user_data || profilePayload || {};
      const planId =
        entitlements?.plan ||
        userData?.subscription_plan_id ||
        (profilePayload as { subscription_plan_id?: string })?.subscription_plan_id ||
        null;
      const hasPlusAccess = planId === "plus" || planId === "pro";
      setSubscriptionInfo({
        hasPaid: Boolean(
          hasPlusAccess ||
            entitlements?.entitled ||
            userData?.has_paid ||
            (profilePayload as { has_paid?: boolean })?.has_paid
        ),
      });
    } catch (e) {
      console.error("Error fetching subscription info:", e);
    }
  }, [entitlements?.entitled, loadProfile]);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  useEffect(() => {
    if (entitlements?.status === "active" || entitlements?.status === "trialing") {
      navigate("/billing", { replace: true });
    }
  }, [entitlements?.status, navigate]);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/plans/`)
      .then((r) => setPlans(r.data?.plans || []))
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const handleSubscriptionNavigate = useCallback(() => {
    if (subscriptionInfo.hasPaid) {
      navigate("/personalized-path");
      return;
    }
    if (!questionnaireComplete) {
      navigate("/onboarding");
      return;
    }
    navigate("/all-topics");
  }, [navigate, subscriptionInfo.hasPaid, questionnaireComplete]);

  const upgradeComplete = useMemo(
    () => new URLSearchParams(location.search).get("redirect") === "upgradeComplete",
    [location.search]
  );

  const handlePlanSelect = useCallback(
    async (plan: Plan | null) => {
      if (!plan) {
        setSelectionError("Please choose a plan to continue.");
        return;
      }
      if (!isAuthenticated) {
        navigate("/register");
        return;
      }
      setSelectionError("");
      const isStarter = plan.plan_id === "starter" || Number(plan.price_amount || 0) === 0;
      if (isStarter) {
        reloadEntitlements?.();
        navigate("/all-topics");
        return;
      }
      if (!questionnaireComplete) {
        setSelectionError("Please complete onboarding before choosing a plan.");
        navigate("/onboarding");
        return;
      }
      try {
        const r = await axios.post(
          `${BACKEND_URL}/subscriptions/create/`,
          { plan_id: plan.plan_id, billing_interval: plan.billing_interval },
          { headers: { Authorization: `Bearer ${getAccessToken?.() ?? ""}` } }
        );
        if (r.data?.redirect_url) {
          window.location.assign(r.data.redirect_url);
          return;
        }
      } catch (err) {
        const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        if (status === 503) {
          setSelectionError(
            message || "Payment is not configured yet. Please try again later or contact support."
          );
        } else {
          setSelectionError(message || "Could not start checkout. Please try again.");
        }
      }
    },
    [isAuthenticated, navigate, questionnaireComplete, reloadEntitlements, getAccessToken]
  );

  useEffect(() => {
    if (typeof recordFunnelEvent === "function") {
      Promise.resolve(recordFunnelEvent("pricing_view")).catch(() => {});
    }
  }, []);

  const planCards = useMemo(
    () => [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [plans]
  );

  const comparisonRows = useMemo(() => {
    if (!plans.length) return [];
    const monthly = plans.filter((p) => p.billing_interval === "monthly");
    const byId = monthly.reduce<Record<string, Plan>>((acc, p) => {
      acc[p.plan_id] = p;
      return acc;
    }, {});
    const keys = new Set<string>();
    Object.values(byId).forEach((p) => Object.keys(p?.features || {}).forEach((k) => keys.add(k)));
    return Array.from(keys).map((key) => {
      const s = byId.starter?.features?.[key];
      const pl = byId.plus?.features?.[key];
      const pr = byId.pro?.features?.[key];
      const label = s?.name || pl?.name || pr?.name || key.replace(/_/g, " ");
      return {
        feature: label,
        starter: formatFeatureValue(s),
        plus: formatFeatureValue(pl),
        pro: formatFeatureValue(pr),
      };
    });
  }, [plans]);

  return (
    <section className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4 py-12">
      <GlassCard padding="xl" className="w-full max-w-4xl space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent,#2563eb)]/10 text-3xl">
            🔒
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-[color:var(--accent,#111827)]">
              Choose Your Plan
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Starter is free after onboarding. Plus and Pro unlock your personalized path and premium features via secure Stripe checkout.
            </p>
            {upgradeComplete && (
              <p className="rounded-lg bg-[color:var(--success,#16a34a)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--success,#16a34a)]">
                Payment confirmed! Your subscription is now active.
              </p>
            )}
            {entitlements?.fallback && (
              <p className="rounded-lg bg-[color:var(--warning,#facc15)]/20 px-3 py-2 text-xs text-[color:var(--accent,#92400e)]">
                Using fallback entitlements. Please contact support if this persists.
              </p>
            )}
            {entitlementError && (
              <p className="text-sm text-[color:var(--error,#dc2626)]">{entitlementError}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {loadingPlans && (
            <div className="text-sm text-[color:var(--muted-text,#6b7280)]">Loading plans...</div>
          )}
          {!loadingPlans &&
            planCards.map((plan) => {
              const features = Object.values(plan.features || {})
                .map((f) => f?.description || f?.name)
                .filter(Boolean);
              const isStarter =
                plan.plan_id === "starter" || Number(plan.price_amount || 0) === 0;
              const isHighlight = plan.plan_id === "plus";
              const trialLabel = plan.trial_days
                ? `${plan.trial_days} day${plan.trial_days > 1 ? "s" : ""} trial`
                : null;
              const name =
                plan.name || plan.plan_id.charAt(0).toUpperCase() + plan.plan_id.slice(1);
              const paidPlan = !isStarter;
              return (
                <div
                  key={`${plan.plan_id}-${plan.billing_interval}`}
                  className={`flex flex-col gap-4 rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-5 text-left shadow-sm ${
                    isHighlight
                      ? "border-[color:var(--primary,#2563eb)] shadow-lg shadow-[color:var(--primary,#2563eb)]/20"
                      : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                        {name}
                      </div>
                      {isStarter && (
                        <span className="rounded-full bg-[color:var(--success,#16a34a)]/15 px-2 py-1 text-xs font-semibold text-[color:var(--success,#16a34a)]">
                          Free
                        </span>
                      )}
                      {trialLabel && paidPlan && (
                        <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-2 py-1 text-xs font-semibold text-[color:var(--primary,#2563eb)]">
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
                        {` / ${plan.billing_interval === "monthly" ? "month" : plan.billing_interval === "yearly" ? "year" : plan.billing_interval}`}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-[color:var(--text-color,#111827)]">
                    {(features.length ? features : ["Premium learning access"]).map((fe) => (
                      <li key={fe}>• {fe}</li>
                    ))}
                  </ul>
                  {paidPlan && (
                    <p className="text-xs text-[color:var(--primary,#2563eb)] font-medium">
                      Unlocks personalized path + secure Stripe checkout
                    </p>
                  )}
                  <GlassButton
                    variant={isHighlight ? "primary" : "ghost"}
                    className="w-full"
                    onClick={() => handlePlanSelect(plan)}
                  >
                    {isStarter
                      ? "Start with Starter (Free)"
                      : `Choose ${name} - Go to checkout`}
                  </GlassButton>
                </div>
              );
            })}
        </div>

        {selectionError && (
          <p className="text-sm text-[color:var(--error,#dc2626)]">{selectionError}</p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <GlassButton
            variant="ghost"
            onClick={() => reloadEntitlements()}
            className="text-sm"
            icon="🔄"
          >
            Retry entitlement check
          </GlassButton>
          {entitlementSupportLink && (
            <a
              href={entitlementSupportLink}
              className="text-sm font-semibold text-[color:var(--accent,#2563eb)] underline"
            >
              Contact support
            </a>
          )}
        </div>

        <div
          className="relative overflow-hidden rounded-3xl border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
              Subscription status
            </p>
            <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
              {subscriptionInfo.hasPaid
                ? "You're on Plus or Pro - personalized path and premium features unlocked."
                : questionnaireComplete
                  ? "You're on Starter (free). Upgrade to Plus or Pro to unlock your personalized path."
                  : "Complete onboarding, then choose Starter (free) or upgrade to Plus/Pro."}
            </p>
            {entitlements?.status === "trialing" && trialEndLabel && (
              <p className="text-xs text-[color:var(--accent,#2563eb)]">
                Trial ends on {trialEndLabel}
              </p>
            )}
          </div>
          <GlassButton
            variant="ghost"
            onClick={handleSubscriptionNavigate}
            icon={subscriptionInfo.hasPaid ? "⭐" : "🚀"}
          >
            {subscriptionInfo.hasPaid
              ? "View your personalized path"
              : questionnaireComplete
                ? "Go to dashboard"
                : "Check subscription options"}
          </GlassButton>
        </div>

        {comparisonRows.length > 0 && (
          <GlassCard padding="lg" className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                Compare plans
              </p>
              <h3 className="text-lg font-bold text-[color:var(--accent,#111827)]">
                See what changes by tier
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[color:var(--input-bg,#f3f4f6)] text-[color:var(--muted-text,#6b7280)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold">Starter</th>
                    <th className="px-4 py-3 font-semibold">Plus</th>
                    <th className="px-4 py-3 font-semibold">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-t border-[color:var(--border-color,#e5e7eb)]"
                    >
                      <td className="px-4 py-3 text-[color:var(--text-color,#111827)]">
                        {row.feature}
                      </td>
                      <td className="px-4 py-3">{row.starter}</td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--primary,#1d5330)]">
                        {row.plus}
                      </td>
                      <td className="px-4 py-3">{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </GlassCard>
    </section>
  );
};

export default SubscriptionPlansPage;
