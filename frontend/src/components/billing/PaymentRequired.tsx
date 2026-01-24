// PaymentRequired.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
import { recordFunnelEvent } from "services/analyticsService";
import { BACKEND_URL } from "services/backendUrl";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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

const formatFeatureValue = (
  feature: PlanFeature | undefined,
  t: TFunction<"billing">
) => {
  if (!feature || feature.enabled === false) {
    return String(t("entitlements.notIncluded"));
  }
  if (feature.daily_quota === null || feature.daily_quota === undefined) {
    return String(t("entitlements.unlimited"));
  }
  if (typeof feature.daily_quota === "number") {
    return String(
      t("entitlements.dailyQuota", {
        defaultValue: "{{count}} / day",
        count: feature.daily_quota,
      })
    );
  }
  return String(t("entitlements.included", { defaultValue: "Included" }));
};

const PaymentRequired = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    entitlements,
    entitlementError,
    entitlementSupportLink,
    reloadEntitlements,
    loadProfile,
    isAuthenticated,
  } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    hasPaid: false,
    questionnaireComplete: false,
  });
  const [selectionError, setSelectionError] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const { t } = useTranslation("billing");
  const locale = getLocale();
  const trialEndLabel = useMemo(() => {
    if (!entitlements?.trialEnd) {
      return null;
    }
    return formatDate(entitlements.trialEnd, locale);
  }, [entitlements?.trialEnd, locale]);

  const fetchSubscriptionInfo = useCallback(async () => {
    try {
      const profilePayload = await loadProfile();
      const userData = profilePayload?.user_data || profilePayload || {};
      setSubscriptionInfo({
        hasPaid: Boolean(entitlements?.entitled || userData?.has_paid),
        questionnaireComplete: Boolean(userData?.is_questionnaire_completed),
      });
    } catch (error) {
      console.error("Error fetching subscription info:", error);
    }
  }, [entitlements?.entitled, loadProfile]);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  useEffect(() => {
    if (
      entitlements?.status === "active" ||
      entitlements?.status === "trialing"
    ) {
      navigate("/billing", { replace: true });
    }
  }, [entitlements?.status, navigate]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/plans/`);
        setPlans(response.data?.plans || []);
      } catch (error) {
        console.warn("Failed to load subscription plans:", error);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubscriptionNavigate = useCallback(() => {
    if (!subscriptionInfo.questionnaireComplete) {
      navigate("/questionnaire");
      return;
    }
    if (!subscriptionInfo.hasPaid) {
      navigate("/subscriptions", { state: { from: "/subscriptions" } });
      return;
    }
    navigate("/personalized-path");
  }, [
    navigate,
    subscriptionInfo.hasPaid,
    subscriptionInfo.questionnaireComplete,
  ]);

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const upgradeComplete = searchParams.get("redirect") === "upgradeComplete";

  const handlePlanSelect = (plan: Plan | null) => {
    if (!plan) {
      setSelectionError(
        t("paymentRequired.choosePlanError", {
          defaultValue: "Please choose a plan to continue.",
        })
      );
      return;
    }
    if (!isAuthenticated) {
      navigate("/register");
      return;
    }
    setSelectionError("");
    const params = new URLSearchParams({
      plan_id: plan.plan_id,
      billing_interval: plan.billing_interval,
    });
    navigate(`/questionnaire?${params.toString()}`);
  };

  useEffect(() => {
    if (typeof recordFunnelEvent === "function") {
      Promise.resolve(recordFunnelEvent("pricing_view")).catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to log pricing view:", error);
      });
    }
  }, []);

  const planCards = useMemo(() => {
    if (!plans.length) return [];
    return [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [plans]);

  const comparisonRows = useMemo(() => {
    if (!plans.length) return [];
    const monthlyPlans = plans.filter(
      (plan) => plan.billing_interval === "monthly"
    );
    const planById = monthlyPlans.reduce<Record<string, Plan>>((acc, plan) => {
      acc[plan.plan_id] = plan;
      return acc;
    }, {});
    const featureKeys = new Set<string>();
    Object.values(planById).forEach((plan) => {
      Object.keys(plan?.features || {}).forEach((key) => featureKeys.add(key));
    });
    if (!featureKeys.size) return [];
    return Array.from(featureKeys).map((key) => {
      const starterFeature = planById.starter?.features?.[key];
      const plusFeature = planById.plus?.features?.[key];
      const proFeature = planById.pro?.features?.[key];
      const label =
        starterFeature?.name ||
        plusFeature?.name ||
        proFeature?.name ||
        key.replace(/_/g, " ");
      return {
        feature: label,
        starter: formatFeatureValue(starterFeature, t),
        plus: formatFeatureValue(plusFeature, t),
        pro: formatFeatureValue(proFeature, t),
      };
    });
  }, [plans, t]);

  return (
    <section className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4 py-12">
      <GlassCard padding="xl" className="w-full max-w-4xl space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent,#2563eb)]/10 text-3xl">
            🔒
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-[color:var(--accent,#111827)]">
              {t("paymentRequired.title")}
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("paymentRequired.subtitle")}
            </p>
            {upgradeComplete && (
              <p className="rounded-lg bg-[color:var(--success,#16a34a)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--success,#16a34a)]">
                {t("paymentRequired.paymentConfirmed")}
              </p>
            )}
            {entitlements?.fallback && (
              <p className="rounded-lg bg-[color:var(--warning,#facc15)]/20 px-3 py-2 text-xs text-[color:var(--accent,#92400e)]">
                {t("paymentRequired.fallback")}
              </p>
            )}
            {entitlementError && (
              <p className="text-sm text-[color:var(--error,#dc2626)]">
                {entitlementError}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {loadingPlans && (
            <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("paymentRequired.loading")}
            </div>
          )}
          {!loadingPlans &&
            planCards.map((plan) => {
              const features = Object.values(plan.features || {})
                .map((feature) => feature?.description || feature?.name)
                .filter(Boolean);
              const isStarter =
                plan.plan_id === "starter" ||
                Number(plan.price_amount || 0) === 0;
              const isHighlight = plan.plan_id === "plus";
              const trialLabel = plan.trial_days
                ? t("paymentRequired.trialLabel", { days: plan.trial_days })
                : null;
              const translatedName = t(`plans.${plan.plan_id}`, {
                defaultValue: plan.name || plan.plan_id,
              });
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
                        {translatedName}
                      </div>
                      {trialLabel && (
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
                        {` ${t(`labels.${plan.billing_interval}`, {
                          defaultValue: plan.billing_interval,
                        })}`}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-[color:var(--text-color,#111827)]">
                    {(features.length
                      ? features
                      : [
                          t("paymentRequired.fallbackFeature", {
                            defaultValue: "Premium learning access",
                          }),
                        ]
                    ).map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                  <GlassButton
                    variant={isHighlight ? "primary" : "ghost"}
                    className="w-full"
                    onClick={() => handlePlanSelect(plan)}
                  >
                    {isStarter
                      ? t("paymentRequired.startStarter", {
                          defaultValue: "Start with Starter",
                        })
                      : t("paymentRequired.choosePlan", {
                          plan: translatedName,
                        })}
                  </GlassButton>
                </div>
              );
            })}
        </div>
        {selectionError && (
          <p className="text-sm text-[color:var(--error,#dc2626)]">
            {selectionError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <GlassButton
            variant="ghost"
            onClick={() => reloadEntitlements()}
            className="text-sm"
            icon="🔄"
          >
            {t("paymentRequired.retryEntitlements", {
              defaultValue: "Retry entitlement check",
            })}
          </GlassButton>
          {entitlementSupportLink && (
            <a
              href={entitlementSupportLink}
              className="text-sm font-semibold text-[color:var(--accent,#2563eb)] underline"
            >
              {t("paymentRequired.contactSupport", {
                defaultValue: "Contact support",
              })}
            </a>
          )}
        </div>

        {/* Subscription Status Card */}
        <div
          className="relative overflow-hidden rounded-3xl border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] backdrop-blur-lg transition-all p-6 hover:shadow-xl hover:shadow-[color:var(--shadow-color,rgba(0,0,0,0.12))] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
              Subscription status
            </p>
            <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
              {subscriptionInfo.hasPaid
                ? "You're all set with Premium access."
                : "Upgrade to unlock unlimited personalized learning."}
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

export default PaymentRequired;
