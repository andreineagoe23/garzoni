// PaymentRequired.js
import React, { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
import { recordFunnelEvent } from "services/analyticsService";

const PaymentRequired = () => {
  const location = useLocation();
  const {
    entitlements,
    entitlementError,
    entitlementSupportLink,
    reloadEntitlements,
  } = useAuth();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const upgradeComplete = searchParams.get("redirect") === "upgradeComplete";

  useEffect(() => {
    if (typeof recordFunnelEvent === "function") {
      Promise.resolve(recordFunnelEvent("pricing_view")).catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to log pricing view:", error);
      });
    }
  }, []);

  return (
    <section className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4 py-12">
      <GlassCard padding="xl" className="w-full max-w-4xl space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent,#2563eb)]/10 text-3xl">
            🔒
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-[color:var(--accent,#111827)]">
              Unlock your personalized path
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Start the upgrade flow to pick a plan, answer a quick questionnaire,
              and complete checkout. We’ll keep you signed in and redirect you
              back to your tailored learning path after payment.
            </p>
            {upgradeComplete && (
              <p className="rounded-lg bg-[color:var(--success,#16a34a)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--success,#16a34a)]">
                Payment confirmed! Click below to continue to your personalized path.
              </p>
            )}
            {entitlements?.fallback && (
              <p className="rounded-lg bg-[color:var(--warning,#facc15)]/20 px-3 py-2 text-xs text-[color:var(--accent,#92400e)]">
                We could not confirm your subscription status. You are temporarily
                in free mode while we retry.
              </p>
            )}
            {entitlementError && (
              <p className="text-sm text-[color:var(--error,#dc2626)]">{entitlementError}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {["Starter", "Pro"].map((tier) => (
            <div
              key={tier}
              className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-5 text-center shadow-sm"
            >
              <div className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                {tier} Plan
              </div>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {tier === "Starter"
                  ? "Great for exploring guided lessons and quizzes."
                  : "Best for full personalized journeys with premium support."}
              </p>
              <Link
                to={upgradeComplete ? "/personalized-path" : "/questionnaire"}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                {upgradeComplete ? "Continue to your path" : "Start with Questionnaire"}
              </Link>
            </div>
          ))}
        </div>

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
      </GlassCard>
    </section>
  );
};

export default PaymentRequired;
