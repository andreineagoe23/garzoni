// PaymentRequired.js
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
import { recordFunnelEvent } from "services/analyticsService";

const PaymentRequired = () => {
  const {
    entitlements,
    entitlementError,
    entitlementSupportLink,
    reloadEntitlements,
  } = useAuth();

  useEffect(() => {
    recordFunnelEvent("pricing_view").catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Failed to log pricing view:", error);
    });
  }, []);

  return (
    <section className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4 py-12">
      <GlassCard padding="xl" className="w-full max-w-xl space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent,#2563eb)]/10 text-3xl">
          🔒
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-[color:var(--accent,#111827)]">
            Payment Required
          </h2>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            You need to complete your payment before accessing this content.
            Once payment is confirmed, you’ll regain full access to your
            personalized learning experience.
          </p>
          {entitlements?.fallback && (
            <p className="rounded-lg bg-[color:var(--warning,#facc15)]/20 px-3 py-2 text-xs text-[color:var(--accent,#92400e)]">
              We could not confirm your subscription status. You are temporarily
              in free mode while we retry.
            </p>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            Need help?
          </p>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Return to the questionnaire to review your plan or contact support
            for assistance.
          </p>
          {entitlementError && (
            <p className="text-sm text-[color:var(--error,#dc2626)]">
              {entitlementError}
            </p>
          )}
          {entitlementSupportLink && (
            <a
              href={entitlementSupportLink}
              className="inline-flex items-center justify-center text-sm font-semibold text-[color:var(--accent,#2563eb)] underline"
            >
              Contact support
            </a>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/questionnaire"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            Return to Questionnaire
          </Link>
          <GlassButton
            variant="ghost"
            onClick={() => reloadEntitlements()}
            className="text-sm"
            icon="🔄"
          >
            Retry entitlement check
          </GlassButton>
        </div>
      </GlassCard>
    </section>
  );
};

export default PaymentRequired;
