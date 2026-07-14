/**
 * Subscriptions / plans page. Rendered at /subscriptions.
 * Imported statically in App so it stays in the main bundle (avoids chunk resolution issues).
 *
 * Billing flow:
 *   When VITE_REVENUECAT_API_KEY is set → RevenueCat Paywall (RC Billing / Stripe via RC).
 *   Otherwise                           → Legacy Django/Stripe backend checkout.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GlassButton, GlassCard } from "components/ui";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import { useAuth } from "contexts/AuthContext";
import { recordFunnelEvent } from "services/analyticsService";
import apiClient from "services/httpClient";
import { fetchQuestionnaireProgress } from "services/questionnaireService";
import { formatCurrency, formatDate, getLocale } from "utils/format";
import { safeRedirectUrl } from "utils/safeRedirectUrl";
import {
  fetchReferralSummary,
  postRevenueCatSync,
  postSubscriptionSync,
} from "@garzoni/core";
import {
  isRevenueCatEnabled,
  isValidAppUserId,
  rcIsEntitled,
  RC_OFFERING_PRO,
} from "services/revenueCatService";
import type { CustomerInfo } from "@revenuecat/purchases-js";
import RevenueCatPaywall from "components/billing/RevenueCatPaywall";

// Promo is fulfilled by the store-side intro offers (App Store / Play), so the
// web pricing page advertises the discount but sends buyers into the app to
// claim it — there is no discounted web checkout during the promo.
const APP_STORE_URL =
  "https://apps.apple.com/gb/app/garzoni-personal-finance/id6761790801";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=app.garzoni.mobile";

const resolvePromoStoreUrl = (): string => {
  if (typeof navigator === "undefined") return APP_STORE_URL;
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return PLAY_STORE_URL;
  if (/iphone|ipad|ipod/i.test(ua)) return APP_STORE_URL;
  return APP_STORE_URL; // desktop default (UK-first audience)
};

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
  promo_price_amount?: number | null;
  promo_duration_label?: string | null;
};

type PromoInfo = {
  id: string;
  percent_off: number;
  ends_on: string;
};

const formatFeatureValue = (
  feature: PlanFeature | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
) => {
  if (!feature || feature.enabled === false)
    return t("subscriptions.notIncluded");
  if (feature.daily_quota === null || feature.daily_quota === undefined)
    return t("subscriptions.unlimited");
  if (typeof feature.daily_quota === "number")
    return t("subscriptions.perDay", { count: feature.daily_quota });
  return t("subscriptions.included");
};

const SubscriptionPlansPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    entitlements,
    entitlementError,
    entitlementSupportLink,
    reloadEntitlements,
    loadProfile,
    isAuthenticated,
    user,
    profile,
  } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    hasPaid: false,
  });
  const [selectionError, setSelectionError] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promo, setPromo] = useState<PromoInfo | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"yearly" | "monthly">(
    "yearly"
  );
  const locale = getLocale();

  // RevenueCat paywall overlay — shown instead of redirecting to Stripe
  // when the RC Web SDK is configured (VITE_REVENUECAT_API_KEY is set).
  const rcEnabled = isRevenueCatEnabled();
  // The RC appUserID must be the numeric Django user PK. Binding a purchase to
  // a placeholder (e.g. "anonymous") charges the card but never activates the
  // plan because the backend webhook ignores non-digit app_user_ids.
  const rcAppUserId = useMemo(() => {
    const id =
      (user as { id?: number } | null)?.id ??
      (profile as { id?: number } | null)?.id;
    return id != null && isValidAppUserId(String(id)) ? String(id) : null;
  }, [user, profile]);
  const [showRCPaywall, setShowRCPaywall] = useState(false);
  /** When set, loads the Pro storefront; omit for Plus (default / current offering). */
  const [rcPaywallOfferingId, setRcPaywallOfferingId] = useState<
    string | undefined
  >(undefined);

  const handleRCSuccess = useCallback(
    async (customerInfo: CustomerInfo) => {
      if (rcIsEntitled(customerInfo)) {
        setSubscriptionInfo({ hasPaid: true });
        const rcAppUserId = customerInfo.originalAppUserId || undefined;
        try {
          await postRevenueCatSync(rcAppUserId);
        } catch {
          // Webhook may still activate shortly; proceed with refresh.
        }
        await reloadEntitlements?.();
        await loadProfile?.({ force: true });
        setShowRCPaywall(false);
        setRcPaywallOfferingId(undefined);
        navigate("/personalized-path");
      }
    },
    [reloadEntitlements, navigate, loadProfile]
  );

  const { data: referralSummary } = useQuery({
    queryKey: ["referral-summary"],
    queryFn: async () => (await fetchReferralSummary()).data,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const { data: questionnaireProgress } = useQuery({
    queryKey: ["questionnaire-progress"],
    queryFn: fetchQuestionnaireProgress,
    enabled: isAuthenticated ?? false,
    staleTime: 0,
  });
  const questionnaireComplete = questionnaireProgress?.status === "completed";

  // ?recommended=pro|plus moves the "Recommended" highlight to that plan
  // (e.g. arriving from the plan-ready segue). Defaults to Plus.
  const recommendedTier = useMemo<"plus" | "pro">(() => {
    const v = new URLSearchParams(location.search).get("recommended");
    return v === "pro" ? "pro" : "plus";
  }, [location.search]);

  // Computed yearly savings % (Plus tier: monthly*12 vs yearly), for the
  // billing toggle anchor. Only meaningful when > 0.
  const yearlySavingsPct = useMemo(() => {
    const m = plans.find(
      (p) => p.plan_id === "plus" && p.billing_interval === "monthly"
    );
    const y = plans.find(
      (p) => p.plan_id === "plus" && p.billing_interval === "yearly"
    );
    const mp = Number(m?.price_amount ?? NaN);
    const yp = Number(y?.price_amount ?? NaN);
    if (!Number.isFinite(mp) || !Number.isFinite(yp) || mp <= 0) return 0;
    const pct = Math.round((1 - yp / (mp * 12)) * 100);
    return pct > 0 ? pct : 0;
  }, [plans]);

  const trialEndLabel = useMemo(
    () =>
      entitlements?.trialEnd ? formatDate(entitlements.trialEnd, locale) : null,
    [entitlements?.trialEnd, locale]
  );

  const fetchSubscriptionInfo = useCallback(async () => {
    try {
      const profilePayload = await loadProfile?.({ force: true });
      const userData = profilePayload?.user_data || profilePayload || {};
      const planId =
        entitlements?.plan ||
        userData?.subscription_plan_id ||
        (profilePayload as { subscription_plan_id?: string })
          ?.subscription_plan_id ||
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
  }, [entitlements?.entitled, entitlements?.plan, loadProfile]);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  const upgradeComplete = useMemo(
    () =>
      new URLSearchParams(location.search).get("redirect") ===
      "upgradeComplete",
    [location.search]
  );

  useEffect(() => {
    if (!upgradeComplete || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        await postSubscriptionSync();
      } catch {
        // Non-blocking: webhooks may update profile asynchronously.
      }
      if (cancelled) return;
      await reloadEntitlements?.();
      await loadProfile?.({ force: true });
      if (!cancelled) {
        void fetchSubscriptionInfo();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    upgradeComplete,
    isAuthenticated,
    reloadEntitlements,
    loadProfile,
    fetchSubscriptionInfo,
  ]);

  useEffect(() => {
    apiClient
      .get("/plans/")
      .then((r) => {
        setPlans(r.data?.plans || []);
        setPromo(r.data?.promo || null);
      })
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

  const handlePlanSelect = useCallback(
    async (plan: Plan | null) => {
      if (!plan) {
        setSelectionError(t("subscriptions.selectPlanError"));
        return;
      }
      if (!isAuthenticated) {
        navigate("/register");
        return;
      }
      setSelectionError("");
      const isStarter =
        plan.plan_id === "starter" || Number(plan.price_amount || 0) === 0;
      if (isStarter) {
        reloadEntitlements?.();
        navigate("/all-topics");
        return;
      }
      if (!questionnaireComplete) {
        setSelectionError(t("subscriptions.completeOnboardingFirst"));
        navigate("/onboarding");
        return;
      }

      // ── RevenueCat flow (preferred when SDK is configured) ──────────────────
      if (rcEnabled) {
        if (!rcAppUserId) {
          // No numeric user PK yet — opening the paywall would bind the
          // purchase to a placeholder id and lose the payment. Force re-auth.
          setSelectionError(t("subscriptions.completeOnboardingFirst"));
          navigate("/login");
          return;
        }
        setRcPaywallOfferingId(
          plan.plan_id === "pro" ? RC_OFFERING_PRO : undefined
        );
        setShowRCPaywall(true);
        return;
      }

      // ── Legacy Stripe/Django flow ────────────────────────────────────────────
      try {
        const r = await apiClient.post("/subscriptions/create/", {
          plan_id: plan.plan_id,
          billing_interval: plan.billing_interval,
        });
        const redirectUrl = safeRedirectUrl(r.data?.redirect_url);
        if (redirectUrl) {
          window.location.assign(redirectUrl);
          return;
        }
      } catch (err) {
        const status = (
          err as { response?: { status?: number; data?: { error?: string } } }
        )?.response?.status;
        const message = (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error;
        if (status === 503) {
          setSelectionError(message || t("subscriptions.paymentNotConfigured"));
        } else {
          setSelectionError(message || t("subscriptions.checkoutFailed"));
        }
      }
    },
    [
      isAuthenticated,
      navigate,
      questionnaireComplete,
      reloadEntitlements,
      rcEnabled,
      rcAppUserId,
      t,
    ]
  );

  useEffect(() => {
    if (typeof recordFunnelEvent === "function") {
      Promise.resolve(recordFunnelEvent("pricing_view")).catch(() => {});
    }
  }, []);

  const planCards = useMemo(() => {
    const sorted = [...plans].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const starter = sorted.find((p) => p.plan_id === "starter");
    const plus = sorted.find(
      (p) => p.plan_id === "plus" && p.billing_interval === billingInterval
    );
    const pro = sorted.find(
      (p) => p.plan_id === "pro" && p.billing_interval === billingInterval
    );
    const out: Plan[] = [];
    if (starter) out.push(starter);
    if (plus) out.push(plus);
    if (pro) out.push(pro);
    return out;
  }, [plans, billingInterval]);

  const comparisonRows = useMemo(() => {
    if (!plans.length) return [];
    const monthly = plans.filter((p) => p.billing_interval === "monthly");
    const byId = monthly.reduce<Record<string, Plan>>((acc, p) => {
      acc[p.plan_id] = p;
      return acc;
    }, {});
    const keys = new Set<string>();
    Object.values(byId).forEach((p) =>
      Object.keys(p?.features || {}).forEach((k) => keys.add(k))
    );
    return Array.from(keys).map((key) => {
      const s = byId.starter?.features?.[key];
      const pl = byId.plus?.features?.[key];
      const pr = byId.pro?.features?.[key];
      const label = s?.name || pl?.name || pr?.name || key.replace(/_/g, " ");
      return {
        feature: label,
        starter: formatFeatureValue(s, t),
        plus: formatFeatureValue(pl, t),
        pro: formatFeatureValue(pr, t),
      };
    });
  }, [plans, t]);

  return (
    <>
      <Helmet>
        <title>Plans &amp; Pricing | Garzoni</title>
        <meta
          name="description"
          content="Compare Garzoni's Starter, Plus, and Pro plans. Structured learning paths, AI tutor, and finance tools. Free to start — no credit card needed."
        />
        <link rel="canonical" href="https://www.garzoni.app/subscriptions" />
      </Helmet>
      <section className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-surface-page px-4 py-12">
        <GlassCard padding="xl" className="w-full max-w-4xl space-y-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="space-y-3">
              <div className="mx-auto h-px w-12 bg-gradient-to-r from-transparent via-[color:var(--color-brand-primary)]/40 to-transparent" />
              <h2 className="text-2xl font-bold tracking-tight text-[color:var(--accent,#111827)]">
                {t("subscriptions.choosePlan")}
              </h2>
              <p className="max-w-lg text-sm text-content-muted">
                {t("subscriptions.intro")}
              </p>
              {upgradeComplete && (
                <p className="rounded-lg bg-[color:var(--color-state-success)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--color-state-success)]">
                  {t("subscriptions.paymentConfirmed")}
                </p>
              )}
              {entitlements?.fallback && (
                <p className="rounded-lg bg-[color:var(--warning,#facc15)]/20 px-3 py-2 text-xs text-[color:var(--accent,#92400e)]">
                  {t("subscriptions.fallbackEntitlements")}
                </p>
              )}
              {entitlementError && (
                <p className="text-sm text-[color:var(--color-state-error)]">
                  {entitlementError}
                </p>
              )}
            </div>
          </div>

          {promo && (
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-[color:var(--gold,#E6C87A)]/50 bg-[color:var(--gold,#E6C87A)]/10 px-4 py-3 text-center">
              <p className="text-base font-bold text-[color:var(--accent,#111827)]">
                {t("subscriptions.promoBanner", {
                  percent: promo.percent_off,
                })}
              </p>
              <p className="text-xs font-medium text-content-muted">
                {t("subscriptions.promoBannerEnds", {
                  date: formatDate(promo.ends_on, locale),
                })}
              </p>
              <p className="text-xs font-semibold text-[color:var(--color-brand-primary)]">
                {t("subscriptions.promoAppHint")}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div
              className="inline-flex rounded-xl border border-[color:var(--color-border-default)] bg-surface-card p-1"
              role="group"
              aria-label={t("subscriptions.choosePlan")}
            >
              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  billingInterval === "yearly"
                    ? "bg-[color:var(--color-brand-primary)] text-white shadow-sm"
                    : "text-content-muted hover:text-[color:var(--accent,#111827)]"
                }`}
              >
                {t("subscriptions.billingYearly")}
                {yearlySavingsPct > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      billingInterval === "yearly"
                        ? "bg-white/20 text-white"
                        : "bg-[color:var(--color-state-success)]/15 text-[color:var(--color-state-success)]"
                    }`}
                  >
                    {`Save ${yearlySavingsPct}%`}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  billingInterval === "monthly"
                    ? "bg-[color:var(--color-brand-primary)] text-white shadow-sm"
                    : "text-content-muted hover:text-[color:var(--accent,#111827)]"
                }`}
              >
                {t("subscriptions.billingMonthly")}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {loadingPlans && (
              <div className="text-sm text-content-muted">
                {t("subscriptions.loadingPlans")}
              </div>
            )}
            {!loadingPlans &&
              planCards.map((plan) => {
                const features = Object.values(plan.features || {})
                  .map((f) => f?.description || f?.name)
                  .filter(Boolean);
                const isStarter =
                  plan.plan_id === "starter" ||
                  Number(plan.price_amount || 0) === 0;
                const isHighlight = plan.plan_id === recommendedTier;
                const trialLabel = plan.trial_days
                  ? t("subscriptions.trialDays", { count: plan.trial_days })
                  : null;
                const name =
                  plan.name ||
                  plan.plan_id.charAt(0).toUpperCase() + plan.plan_id.slice(1);
                const paidPlan = !isStarter;
                const promoPrice =
                  paidPlan && plan.promo_price_amount != null
                    ? Number(plan.promo_price_amount)
                    : null;
                return (
                  <div
                    key={plan.plan_id}
                    className={`relative flex flex-col gap-4 rounded-2xl border bg-surface-card p-5 text-left transition-shadow duration-200 ${
                      isHighlight
                        ? "border-[color:var(--gold,#E6C87A)]/50 shadow-lg shadow-[color:var(--gold,#E6C87A)]/10 ring-1 ring-[color:var(--gold,#E6C87A)]/20"
                        : "border-[color:var(--color-border-default)] shadow-sm hover:shadow-md"
                    }`}
                  >
                    {isHighlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--gold,#E6C87A)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#0B0F14]">
                        Recommended
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                          {name}
                        </div>
                        {isStarter && (
                          <span className="rounded-full bg-[color:var(--color-state-success)]/15 px-2 py-1 text-xs font-semibold text-[color:var(--color-state-success)]">
                            {t("subscriptions.free")}
                          </span>
                        )}
                        {trialLabel && paidPlan && (
                          <span className="rounded-full bg-[color:var(--color-brand-primary)]/10 px-2 py-1 text-xs font-semibold text-[color:var(--color-brand-primary)]">
                            {trialLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-3xl font-extrabold text-content-primary">
                        {promoPrice != null && (
                          <span className="mr-2 text-lg font-semibold text-content-muted line-through">
                            {formatCurrency(
                              Number(plan.price_amount || 0),
                              plan.currency || "USD",
                              locale,
                              { minimumFractionDigits: 0 }
                            )}
                          </span>
                        )}
                        {formatCurrency(
                          promoPrice != null
                            ? promoPrice
                            : Number(plan.price_amount || 0),
                          plan.currency || "USD",
                          locale,
                          { minimumFractionDigits: 0 }
                        )}
                        <span className="ml-1 text-xs font-medium text-content-muted">
                          {` / ${
                            plan.billing_interval === "monthly"
                              ? t("subscriptions.perMonth")
                              : plan.billing_interval === "yearly"
                                ? t("subscriptions.perYear")
                                : plan.billing_interval
                          }`}
                        </span>
                      </div>
                      {promoPrice != null && promo && (
                        <p className="text-xs font-semibold text-[color:var(--color-brand-primary)]">
                          {t("subscriptions.promoBadge", {
                            percent: promo.percent_off,
                          })}{" "}
                          {plan.billing_interval === "yearly"
                            ? t("subscriptions.promoFirstYear")
                            : t("subscriptions.promoFirstMonths")}
                        </p>
                      )}
                      {paidPlan && plan.billing_interval === "yearly" && (
                        <p className="text-xs text-content-muted">
                          {`That's ${formatCurrency(
                            (promoPrice != null
                              ? promoPrice
                              : Number(plan.price_amount || 0)) / 52,
                            plan.currency || "USD",
                            locale,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}/week — less than a coffee`}
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2.5 text-sm text-content-primary">
                      {(features.length
                        ? features
                        : [t("subscriptions.premiumLearningAccess")]
                      ).map((fe) => (
                        <li key={fe} className="flex items-start gap-2">
                          <GarzoniIcon
                            name="check"
                            size={14}
                            className="mt-0.5 shrink-0 text-[color:var(--color-brand-primary)]"
                          />
                          <span>{fe}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex flex-col gap-2">
                      <GlassButton
                        variant={isHighlight ? "active" : "ghost"}
                        className="w-full"
                        onClick={() => {
                          // During the promo, the discount only exists as a
                          // store-side intro offer — send paid buyers into the
                          // app to claim it rather than through web checkout.
                          if (promoPrice != null) {
                            Promise.resolve(
                              recordFunnelEvent("promo_app_redirect", {
                                plan: plan.plan_id,
                                interval: plan.billing_interval,
                              })
                            ).catch(() => {});
                            window.open(
                              resolvePromoStoreUrl(),
                              "_blank",
                              "noopener,noreferrer"
                            );
                            return;
                          }
                          handlePlanSelect(plan);
                        }}
                      >
                        {isStarter ? (
                          t("subscriptions.startStarter")
                        ) : promoPrice != null ? (
                          t("subscriptions.promoCtaApp", {
                            percent: promo?.percent_off ?? 60,
                          })
                        ) : (
                          <>
                            {t("subscriptions.choosePlanCheckout", { name })}{" "}
                            <span aria-hidden="true">›</span>
                          </>
                        )}
                      </GlassButton>

                      {/* Promo web dead-end fix: promo cards otherwise only open
                          the app/store. Always offer a native web checkout at
                          full price so web buyers are never bounced off-site
                          with no on-web path to purchase. */}
                      {promoPrice != null && (
                        <GlassButton
                          variant="ghost"
                          className="w-full"
                          onClick={() => {
                            Promise.resolve(
                              recordFunnelEvent("promo_web_fullprice_click", {
                                plan: plan.plan_id,
                                interval: plan.billing_interval,
                              })
                            ).catch(() => {});
                            handlePlanSelect(plan);
                          }}
                        >
                          Continue on web at full price ›
                        </GlassButton>
                      )}

                      {paidPlan && (
                        <p className="text-center text-[11px] text-content-muted">
                          No commitment — cancel anytime
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <p className="text-center text-sm text-content-muted">
            <Trans
              i18nKey="subscriptions.agreeToTerms"
              components={{
                terms: (
                  <Link
                    key="terms"
                    to="/terms-of-service"
                    className="text-[color:var(--color-brand-primary)] hover:underline"
                  />
                ),
                privacy: (
                  <Link
                    key="privacy"
                    to="/privacy-policy"
                    className="text-[color:var(--color-brand-primary)] hover:underline"
                  />
                ),
              }}
            />
          </p>

          {referralSummary?.earned_discount_code && !rcEnabled ? (
            <p className="rounded-xl border border-[color:var(--color-brand-primary)]/30 bg-[color:var(--primary-soft,rgba(29,83,48,0.08))] px-4 py-3 text-sm text-content-primary">
              {t("subscriptions.referralDiscountBanner", {
                code: referralSummary.earned_discount_code,
              })}
            </p>
          ) : null}

          {selectionError && (
            <p className="text-sm text-[color:var(--color-state-error)]">
              {selectionError}
            </p>
          )}

          <div
            className="relative overflow-hidden rounded-3xl border-[color:var(--color-border-default)] bg-surface-card shadow-xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-content-primary">
                {t("subscriptions.subscriptionStatus")}
              </p>
              <p className="text-xs text-content-muted">
                {subscriptionInfo.hasPaid
                  ? t("subscriptions.statusPaid")
                  : questionnaireComplete
                    ? t("subscriptions.statusStarterComplete")
                    : t("subscriptions.statusOnboarding")}
              </p>
              {entitlements?.status === "trialing" && trialEndLabel && (
                <p className="text-xs text-[color:var(--accent,#ffd700)]">
                  {t("subscriptions.trialEndsOn", { date: trialEndLabel })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <GlassButton
                variant="ghost"
                onClick={handleSubscriptionNavigate}
                icon={
                  <GarzoniIcon
                    name={subscriptionInfo.hasPaid ? "star" : "rocket"}
                    size={16}
                  />
                }
              >
                {subscriptionInfo.hasPaid
                  ? t("subscriptions.viewPersonalizedPath")
                  : questionnaireComplete
                    ? t(
                        "subscriptions.skipForNow",
                        "Skip for now — start learning free"
                      )
                    : t("subscriptions.checkSubscriptionOptions")}
              </GlassButton>
              {(subscriptionInfo.hasPaid ||
                entitlements?.status === "trialing") && (
                <GlassButton
                  variant="primary"
                  onClick={() => navigate("/billing")}
                >
                  {t("billing.manageSubscription")}
                </GlassButton>
              )}
            </div>
          </div>

          {comparisonRows.length > 0 && (
            <GlassCard padding="lg" className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                  {t("subscriptions.comparePlans")}
                </p>
                <h3 className="text-lg font-bold text-[color:var(--accent,#111827)]">
                  {t("subscriptions.seeWhatChanges")}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[color:var(--input-bg,#f3f4f6)] text-content-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        {t("subscriptions.feature")}
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        {t("subscriptions.starter")}
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        {t("subscriptions.plus")}
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        {t("subscriptions.pro")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr
                        key={row.feature}
                        className="border-t border-[color:var(--color-border-default)]"
                      >
                        <td className="px-4 py-3 text-content-primary">
                          {row.feature}
                        </td>
                        <td className="px-4 py-3">{row.starter}</td>
                        <td className="px-4 py-3 font-semibold text-[color:var(--color-brand-primary)]">
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

          <div className="flex flex-wrap items-center justify-center gap-3 text-center pt-2">
            <GlassButton
              variant="ghost"
              onClick={() => reloadEntitlements()}
              className="text-sm"
            >
              {t("subscriptions.retryEntitlements")}
            </GlassButton>
            {entitlementSupportLink && (
              <a
                href={entitlementSupportLink}
                className="text-sm font-semibold text-[color:var(--accent,#ffd700)] underline"
              >
                {t("subscriptions.contactSupport")}
              </a>
            )}
          </div>
        </GlassCard>
      </section>

      {/* ── RevenueCat Paywall overlay ──────────────────────────────────────── */}
      {showRCPaywall && rcEnabled && rcAppUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Subscription paywall"
        >
          <RevenueCatPaywall
            userId={rcAppUserId ?? ""}
            offeringIdentifier={rcPaywallOfferingId}
            onSuccess={handleRCSuccess}
            onClose={() => {
              void apiClient
                .post(
                  "/notifications/client-track/",
                  {
                    name: "checkout_abandoned",
                    properties: { source: "revenuecat_paywall" },
                  },
                  { skipAuthRedirect: true }
                )
                .catch(() => {});
              setRcPaywallOfferingId(undefined);
              setShowRCPaywall(false);
            }}
          />
        </div>
      )}
    </>
  );
};

export default SubscriptionPlansPage;
