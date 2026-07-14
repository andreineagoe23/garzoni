/**
 * RevenueCat Paywall — web implementation.
 *
 * Fetches the current RC Offering and renders plan cards for every available
 * Package (Monthly / Yearly / Lifetime).  Selecting a plan triggers
 * Stripe Checkout via RC Billing.
 *
 * Usage:
 *   <RevenueCatPaywall
 *     userId={user.id.toString()}
 *     onSuccess={(customerInfo) => { ... }}
 *     onClose={() => { ... }}
 *   />
 *
 * Prerequisites:
 *   - VITE_REVENUECAT_API_KEY must be set in frontend/.env
 *   - Products configured in RC Dashboard with identifiers:
 *       $rc_monthly · $rc_annual · $rc_lifetime
 *   - Entitlements "Garzoni Plus" / "Garzoni Pro" (shared with mobile)
 *   - Plus: default offering (`offerings.current`). Pro: offering id `pro`.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type CustomerInfo, type Package } from "@revenuecat/purchases-js";
import { recordFunnelEvent } from "services/analyticsService";
import {
  configureRevenueCat,
  isValidAppUserId,
  rcGetOfferings,
  rcGetCustomerInfo,
  rcPurchase,
  rcRestorePurchases,
  rcIsEntitled,
  rcGetActivePlan,
  rcGetEntitlementStore,
  rcIsManagedElsewhere,
  rcStoreLabel,
  rcShowCustomerCenter,
  formatRCPackagePrice,
  rcPackagePeriodLabel,
  RC_OFFERING_PRO,
} from "services/revenueCatService";
import { GlassButton, GlassCard } from "components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueCatPaywallProps {
  /** Stable user identifier — your Django user PK as a string. */
  userId: string;
  /** Called after a successful purchase or entitlement restore. */
  onSuccess?: (customerInfo: CustomerInfo) => void;
  /** Called when the user explicitly dismisses the paywall. */
  onClose?: () => void;
  /** Override the offering identifier to display (defaults to current). */
  offeringIdentifier?: string;
}

interface PlanCard {
  pkg: Package;
  label: string;
  price: string;
  period: string;
  isBestValue: boolean;
  isLifetime: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PACKAGE_SORT_ORDER: Record<string, number> = {
  $rc_monthly: 1,
  $rc_annual: 0, // show yearly first (best value)
  $rc_lifetime: 2,
  MONTHLY: 1,
  ANNUAL: 0,
  LIFETIME: 2,
};

function sortedPlans(packages: Package[]): PlanCard[] {
  return [...packages]
    .sort((a, b) => {
      const ao = PACKAGE_SORT_ORDER[a.packageType as string] ?? 9;
      const bo = PACKAGE_SORT_ORDER[b.packageType as string] ?? 9;
      return ao - bo;
    })
    .map((pkg) => {
      const type = pkg.packageType as string;
      const isYearly = type === "ANNUAL" || type === "$rc_annual";
      const isLifetime = type === "LIFETIME" || type === "$rc_lifetime";
      const label = isLifetime ? "Lifetime" : isYearly ? "Yearly" : "Monthly";
      return {
        pkg,
        label,
        price: formatRCPackagePrice(pkg),
        period: rcPackagePeriodLabel(pkg),
        isBestValue: isYearly,
        isLifetime,
      };
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

const RevenueCatPaywall: React.FC<RevenueCatPaywallProps> = ({
  userId,
  onSuccess,
  onClose,
  offeringIdentifier,
}) => {
  const { t } = useTranslation();

  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null); // package identifier
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [alreadyEntitled, setAlreadyEntitled] = useState(false);
  const [entitledInfo, setEntitledInfo] = useState<CustomerInfo | null>(null);

  // Exit-intent: intercept the first dismiss with a monthly downsell offer.
  const [showExitIntent, setShowExitIntent] = useState(false);
  const exitIntentUsedRef = useRef(false);
  const monthlyPlan = plans.find((p) => p.label === "Monthly") ?? null;

  const unlockHeadline =
    offeringIdentifier === RC_OFFERING_PRO ? "Garzoni Pro" : "Garzoni Plus";

  // ── Initialize SDK + fetch offerings ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError("");
      if (!isValidAppUserId(userId)) {
        // Guard: a purchase bound to a non-numeric appUserID is charged but
        // never activates the user's plan. Refuse to render the storefront.
        setError(
          "We couldn't confirm your account. Please sign in again before subscribing."
        );
        setLoading(false);
        return;
      }
      try {
        configureRevenueCat(userId);

        // Clash guard: if this account is already subscribed (commonly via the
        // App Store / Play Store), never show a buy button — a second purchase
        // here would double-charge the user. Show their status instead.
        try {
          const info = await rcGetCustomerInfo();
          if (rcIsEntitled(info) && !cancelled) {
            setEntitledInfo(info);
            setAlreadyEntitled(true);
            setLoading(false);
            return;
          }
        } catch {
          // Soft-fail: if the status check errors, fall through to the
          // storefront rather than blocking a legitimate first purchase.
        }

        const offerings = await rcGetOfferings();

        // Prefer the explicit offering id; fall back to the current offering.
        const offering =
          (offeringIdentifier && offerings.all[offeringIdentifier]) ||
          offerings.current;

        if (!offering || !offering.availablePackages.length) {
          setError("No plans available at the moment. Please try again later.");
          return;
        }

        if (!cancelled) {
          setPlans(sortedPlans(offering.availablePackages));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            "Unable to load plans. Please check your connection and try again."
          );
          console.error("[RevenueCat Paywall] init error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [userId, offeringIdentifier]);

  // ── Purchase ─────────────────────────────────────────────────────────────────
  const handlePurchase = useCallback(
    async (plan: PlanCard) => {
      setError("");
      setPurchasing(plan.pkg.identifier);
      try {
        const customerInfo = await rcPurchase(plan.pkg);
        if (rcIsEntitled(customerInfo)) {
          onSuccess?.(customerInfo);
        } else {
          setError(
            "Purchase completed but entitlement not yet active. " +
              "Please restore purchases or contact support."
          );
        }
      } catch (err) {
        const rcErr = err as {
          userCancelledPurchase?: boolean;
          message?: string;
        };
        if (rcErr?.userCancelledPurchase) {
          // User closed Stripe Checkout — not an error.
          return;
        }
        setError(rcErr?.message || "Purchase failed. Please try again.");
        console.error("[RevenueCat Paywall] purchase error:", err);
      } finally {
        setPurchasing(null);
      }
    },
    [onSuccess]
  );

  // ── Restore ──────────────────────────────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    setError("");
    setRestoring(true);
    try {
      const customerInfo = await rcRestorePurchases();
      if (rcIsEntitled(customerInfo)) {
        setEntitledInfo(customerInfo);
        setAlreadyEntitled(true);
        onSuccess?.(customerInfo);
      } else {
        setError("No active subscription found for this account.");
      }
    } catch (err) {
      const rcErr = err as { message?: string };
      setError(rcErr?.message || "Restore failed. Please try again.");
      console.error("[RevenueCat Paywall] restore error:", err);
    } finally {
      setRestoring(false);
    }
  }, [onSuccess]);

  // ── Exit-intent (monthly downsell before real dismiss) ──────────────────────
  const handleSkipClick = useCallback(() => {
    // Only intercept once per paywall open, and only if there's a monthly
    // package to downsell to. Otherwise dismiss for real.
    if (
      !exitIntentUsedRef.current &&
      monthlyPlan &&
      !purchasing &&
      !restoring
    ) {
      exitIntentUsedRef.current = true;
      setShowExitIntent(true);
      Promise.resolve(
        recordFunnelEvent("exit_intent_shown", {
          source: "revenuecat_paywall",
        })
      ).catch(() => {});
      return;
    }
    onClose?.();
  }, [monthlyPlan, purchasing, restoring, onClose]);

  const handleExitAccept = useCallback(() => {
    if (!monthlyPlan) return;
    Promise.resolve(
      recordFunnelEvent("exit_intent_accepted", {
        source: "revenuecat_paywall",
      })
    ).catch(() => {});
    setShowExitIntent(false);
    void handlePurchase(monthlyPlan);
  }, [monthlyPlan, handlePurchase]);

  const handleExitDecline = useCallback(() => {
    Promise.resolve(
      recordFunnelEvent("exit_intent_declined", {
        source: "revenuecat_paywall",
      })
    ).catch(() => {});
    setShowExitIntent(false);
    onClose?.();
  }, [onClose]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (alreadyEntitled) {
    const activePlan = entitledInfo ? rcGetActivePlan(entitledInfo) : "plus";
    const managedElsewhere = entitledInfo
      ? rcIsManagedElsewhere(entitledInfo)
      : false;
    const storeLabel = entitledInfo
      ? rcStoreLabel(rcGetEntitlementStore(entitledInfo))
      : "another platform";
    return (
      <GlassCard padding="lg" className="space-y-4 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-xl font-bold text-content-primary">
          Garzoni {activePlan === "pro" ? "Pro" : "Plus"} active
        </h2>
        <p className="text-sm text-content-muted">
          {managedElsewhere
            ? `You're already subscribed. This plan is billed through ${storeLabel}, so manage or change it there to avoid being charged twice.`
            : "Your subscription is active."}
        </p>
        {managedElsewhere && (
          <GlassButton
            variant="ghost"
            onClick={() => void rcShowCustomerCenter()}
          >
            Manage subscription
          </GlassButton>
        )}
        {onClose && (
          <GlassButton variant="primary" onClick={onClose}>
            Continue
          </GlassButton>
        )}
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard padding="lg" className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-bold text-content-primary">
            Unlock {unlockHeadline}
          </h2>
          <p className="text-sm text-content-muted">
            Get unlimited access to all courses, exercises, and premium
            features.
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl bg-surface-card"
              />
            ))}
          </div>
        )}

        {/* Plan cards */}
        {!loading && plans.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isBusy = purchasing === plan.pkg.identifier;
              return (
                <div
                  key={plan.pkg.identifier}
                  className={[
                    "relative flex flex-col gap-4 rounded-2xl border p-5 text-left shadow-sm transition",
                    plan.isBestValue
                      ? "border-[color:var(--color-brand-primary)] shadow-lg shadow-[color:var(--color-brand-primary)]/20 bg-surface-card"
                      : "border-[color:var(--color-border-default)] bg-surface-card",
                  ].join(" ")}
                >
                  {/* Best value badge */}
                  {plan.isBestValue && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color:var(--color-brand-primary)] px-3 py-0.5 text-xs font-bold text-white shadow">
                      Best value
                    </span>
                  )}

                  <div className="space-y-1 pt-2">
                    <p className="text-lg font-semibold text-content-primary">
                      {plan.label}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-content-primary">
                        {plan.price || "—"}
                      </span>
                      {plan.period && (
                        <span className="text-xs font-medium text-content-muted">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    {plan.isLifetime && (
                      <p className="text-xs text-content-muted">
                        Pay once, own forever
                      </p>
                    )}
                  </div>

                  <ul className="space-y-1.5 text-sm text-content-primary">
                    <li>✓ All premium courses</li>
                    <li>✓ Unlimited AI tutor</li>
                    <li>✓ Advanced exercises</li>
                    {(plan.isBestValue || plan.isLifetime) && (
                      <li>✓ Priority support</li>
                    )}
                  </ul>

                  <div className="mt-auto flex flex-col gap-1.5">
                    <GlassButton
                      variant={plan.isBestValue ? "primary" : "ghost"}
                      className="w-full"
                      disabled={Boolean(purchasing) || restoring}
                      loading={isBusy}
                      onClick={() => void handlePurchase(plan)}
                    >
                      {isBusy ? "Opening checkout…" : `Choose ${plan.label} ›`}
                    </GlassButton>
                    {!plan.isLifetime && (
                      <p className="text-center text-[11px] text-content-muted">
                        No commitment — cancel anytime
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="rounded-xl bg-[color:var(--color-state-error)]/10 px-4 py-3 text-sm text-[color:var(--color-state-error)]">
            {error}
          </p>
        )}

        {/* Skip for now — own full-width row so it's always visible, not buried
          next to Restore. Free users should never feel trapped on the paywall. */}
        {onClose && (
          <div className="border-t border-[color:var(--color-border-default)] pt-4">
            <GlassButton
              variant="ghost"
              size="md"
              className="w-full"
              disabled={Boolean(purchasing) || restoring}
              onClick={handleSkipClick}
            >
              {t("common.skipForNow", "Skip for now — keep exploring for free")}
            </GlassButton>
          </div>
        )}

        {/* Restore */}
        <div className="flex items-center justify-center">
          <GlassButton
            variant="ghost"
            size="sm"
            disabled={restoring || Boolean(purchasing)}
            loading={restoring}
            onClick={() => void handleRestore()}
          >
            {restoring ? "Restoring…" : "Restore purchases"}
          </GlassButton>
        </div>

        {/* Legal */}
        <p className="text-center text-xs text-content-muted">
          Subscriptions auto-renew unless cancelled at least 24 hours before the
          end of the current period. Manage or cancel anytime in your account
          settings.
        </p>
      </GlassCard>

      {/* Exit-intent downsell — shown once before the paywall actually closes. */}
      {showExitIntent && monthlyPlan && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Try monthly instead"
        >
          <GlassCard
            padding="lg"
            className="w-full max-w-sm space-y-5 text-center"
          >
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-content-primary">
                Not ready for a year?
              </h3>
              <p className="text-sm text-content-muted">
                Try monthly instead — {monthlyPlan.price}
                {monthlyPlan.period ? ` ${monthlyPlan.period}` : ""}. Cancel
                anytime.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <GlassButton
                variant="primary"
                className="w-full"
                disabled={Boolean(purchasing) || restoring}
                loading={purchasing === monthlyPlan.pkg.identifier}
                onClick={handleExitAccept}
              >
                {`Start monthly — ${monthlyPlan.price}${
                  monthlyPlan.period ? ` ${monthlyPlan.period}` : ""
                } ›`}
              </GlassButton>
              <GlassButton
                variant="ghost"
                className="w-full"
                disabled={Boolean(purchasing) || restoring}
                onClick={handleExitDecline}
              >
                No thanks
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
};

export default RevenueCatPaywall;
