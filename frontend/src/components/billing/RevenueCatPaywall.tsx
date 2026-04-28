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
 *   - Entitlements "Garzoni Educational Plus" / "Garzoni Educational Pro"
 *   - Plus: default offering (`offerings.current`). Pro: offering id `pro`.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type CustomerInfo, type Package } from "@revenuecat/purchases-js";
import {
  configureRevenueCat,
  rcGetOfferings,
  rcPurchase,
  rcRestorePurchases,
  rcIsEntitled,
  rcGetActivePlan,
  formatRCPackagePrice,
  rcPackagePeriodLabel,
  RC_OFFERING_PLUS,
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

  const unlockHeadline =
    offeringIdentifier === RC_OFFERING_PRO ? "Garzoni Pro" : "Garzoni Plus";

  // ── Initialize SDK + fetch offerings ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError("");
      try {
        configureRevenueCat(userId);
        const offerings = await rcGetOfferings();

        const offering =
          !offeringIdentifier ||
          offeringIdentifier === RC_OFFERING_PLUS ||
          offeringIdentifier === "default"
            ? offerings.current
            : offerings.all[offeringIdentifier];

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

  // ── Render ───────────────────────────────────────────────────────────────────

  if (alreadyEntitled) {
    const activePlan = entitledInfo ? rcGetActivePlan(entitledInfo) : "plus";
    return (
      <GlassCard padding="lg" className="space-y-4 text-center">
        <p className="text-3xl">✅</p>
        <h2 className="text-xl font-bold text-content-primary">
          Garzoni {activePlan === "pro" ? "Pro" : "Plus"} active
        </h2>
        <p className="text-sm text-content-muted">
          Your subscription has been restored successfully.
        </p>
        {onClose && (
          <GlassButton variant="primary" onClick={onClose}>
            Continue
          </GlassButton>
        )}
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg" className="w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-bold text-content-primary">
          Unlock {unlockHeadline}
        </h2>
        <p className="text-sm text-content-muted">
          Get unlimited access to all courses, exercises, and premium features.
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
                    ? "border-[color:var(--primary,#1d5330)] shadow-lg shadow-[color:var(--primary,#1d5330)]/20 bg-surface-card"
                    : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-surface-card",
                ].join(" ")}
              >
                {/* Best value badge */}
                {plan.isBestValue && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-0.5 text-xs font-bold text-white shadow">
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

                <GlassButton
                  variant={plan.isBestValue ? "primary" : "ghost"}
                  className="mt-auto w-full"
                  disabled={Boolean(purchasing) || restoring}
                  loading={isBusy}
                  onClick={() => void handlePurchase(plan)}
                >
                  {isBusy ? "Opening checkout…" : `Choose ${plan.label}`}
                </GlassButton>
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="rounded-xl bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]">
          {error}
        </p>
      )}

      {/* Restore + dismiss */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-color,#e5e7eb)] pt-4">
        <GlassButton
          variant="ghost"
          size="sm"
          disabled={restoring || Boolean(purchasing)}
          loading={restoring}
          onClick={() => void handleRestore()}
        >
          {restoring ? "Restoring…" : "Restore purchases"}
        </GlassButton>

        {onClose && (
          <GlassButton
            variant="ghost"
            size="sm"
            disabled={Boolean(purchasing) || restoring}
            onClick={onClose}
          >
            {t("common.dismiss", "Maybe later")}
          </GlassButton>
        )}
      </div>

      {/* Legal */}
      <p className="text-center text-xs text-content-muted">
        Subscriptions auto-renew unless cancelled at least 24 hours before the
        end of the current period. Manage or cancel anytime in your account
        settings.
      </p>
    </GlassCard>
  );
};

export default RevenueCatPaywall;
