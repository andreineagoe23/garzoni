/**
 * TrialTimeline — Blinkist-pattern trial transparency timeline (UX plan 2.4).
 *
 * Renders a subtle 3-step vertical timeline for plans/packages with a free
 * trial, placed above the CTA:
 *   Today      — full access unlocked
 *   Day {N-2}  — we remind you before your trial ends
 *   Day {N}    — subscription starts
 *
 * The Day {N-2} reminder promise is backed by the backend `trial-ending` CIO
 * event (2 days pre-expiry). Copy is hardcoded English pending i18n keys in
 * packages/core (the repo i18n test forbids unknown t() keys).
 */
import React from "react";
import type { Package } from "@revenuecat/purchases-js";

export interface TrialTimelineProps {
  /** Length of the free trial in days (render nothing when <= 0). */
  trialDays: number;
  className?: string;
}

/**
 * Extract the free-trial length in days from a RevenueCat web Package, or 0
 * when the package has no free trial. Reads `webBillingProduct.freeTrialPhase`
 * (trials always have a null price in the RC web SDK, so a present trial phase
 * means a free trial — the "introPrice zero" check from the plan maps to this).
 * Defensive against older SDK payload shapes via the deprecated
 * `rcBillingProduct` fallback.
 */
export function getPackageTrialDays(pkg: Package): number {
  try {
    const product =
      (pkg as { webBillingProduct?: Package["webBillingProduct"] })
        .webBillingProduct ??
      (pkg as { rcBillingProduct?: Package["webBillingProduct"] })
        .rcBillingProduct;
    const trial = product?.freeTrialPhase;
    const period = trial?.period;
    if (!period || !Number.isFinite(period.number) || period.number <= 0) {
      return 0;
    }
    switch (period.unit) {
      case "day":
        return period.number;
      case "week":
        return period.number * 7;
      case "month":
        return period.number * 30;
      case "year":
        return period.number * 365;
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

const TrialTimeline: React.FC<TrialTimelineProps> = ({
  trialDays,
  className = "",
}) => {
  if (!Number.isFinite(trialDays) || trialDays <= 0) return null;

  const reminderDay = Math.max(1, trialDays - 2);
  const steps = [
    { key: "today", label: "Today", text: "Full access unlocked" },
    {
      key: "reminder",
      label: `Day ${reminderDay}`,
      text: "We remind you before your trial ends",
    },
    {
      key: "start",
      label: `Day ${trialDays}`,
      text: "Subscription starts",
    },
  ];

  return (
    <ol
      className={`space-y-0 text-left ${className}`}
      aria-label={`How your ${trialDays}-day free trial works`}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-0">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  index === 0
                    ? "bg-[color:var(--color-brand-primary)]"
                    : "border border-[color:var(--color-brand-primary)]/50 bg-transparent"
                }`}
              />
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="w-px flex-1 bg-[color:var(--color-brand-primary)]/25"
                />
              )}
            </div>
            <div className={isLast ? "pb-0" : "pb-3"}>
              <p className="text-xs font-semibold leading-none text-content-primary">
                {step.label}
              </p>
              <p className="mt-0.5 text-[11px] text-content-muted">
                {step.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default TrialTimeline;
