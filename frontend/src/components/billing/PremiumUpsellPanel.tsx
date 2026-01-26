import React, { useMemo, useState } from "react";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
const CHECKOUT_URL =
  process.env.REACT_APP_CHECKOUT_URL || "https://pay.monevo.app/checkout";

const canSendAnalytics = () =>
  typeof window !== "undefined" &&
  typeof window.gtag === "function" &&
  window.Cookiebot?.consent?.statistics;

const trackPremiumEvent = (
  eventName: string,
  payload: Record<string, unknown>
) => {
  if (!canSendAnalytics() || !window.gtag) return;
  window.gtag("event", eventName, {
    send_to: "G-0H3QCDXCE8",
    event_category: "premium",
    ...payload,
  });
};

const PremiumUpsellPanel = () => {
  const { user } = useAuth();
  const [referralCopied, setReferralCopied] = useState(false);

  const appOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.monevo.com";

  const referralCode = useMemo(() => {
    if (user?.username) return `${user.username}-invite`;
    if (user?.email) return `${user.email.split("@")[0]}-invite`;
    return "MONEVO-FRIEND";
  }, [user?.email, user?.username]);

  const referralLink = `${appOrigin}/register?ref=${encodeURIComponent(
    referralCode
  )}`;

  const buildCheckoutLink = (context: string) => {
    const params = new URLSearchParams({
      context,
      source: "dashboard-upsell",
    });
    return `${CHECKOUT_URL}?${params.toString()}`;
  };

  const handleTrialClick = () => {
    trackPremiumEvent("premium_trial_click", {
      context: "short-trial",
      location: "dashboard_upsell",
    });

    const link = buildCheckoutLink("short-trial");
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleReferralClick = async () => {
    trackPremiumEvent("premium_referral_share", {
      context: "referral",
      location: "dashboard_upsell",
    });

    try {
      await navigator.clipboard?.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 3000);
    } catch (error) {
      console.error("Unable to copy referral link", error);
      setReferralCopied(false);
    }
  };

  return (
    <GlassCard padding="lg" className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 via-[color:var(--primary,#1d5330)]/10 to-transparent px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Upgrade to Premium
            </p>
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              Unlock Premium Features
            </h4>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Get unlimited access to all learning features
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton variant="active" size="sm" onClick={handleTrialClick}>
            Start Free Trial
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleReferralClick}
            className={
              referralCopied ? "border-green-500/60 text-green-700" : ""
            }
          >
            {referralCopied
              ? "Copied!"
              : "Share Referral"}
          </GlassButton>
        </div>
        <div className="rounded-xl bg-white/50 px-3 py-2 text-xs text-[color:var(--muted-text,#6b7280)]">
          Checkout URL:{" "}
          <span className="font-semibold text-[color:var(--accent,#111827)]">
            {CHECKOUT_URL.replace(/^https?:\/\//, "")}
          </span>{" "}
          with params{" "}
          <code className="font-mono text-[color:var(--accent,#111827)]">
            ?context=...
          </code>{" "}
          and{" "}
          <code className="font-mono text-[color:var(--accent,#111827)]">
            source=dashboard-upsell
          </code>{" "}
          for attribution tracking
        </div>
        <div className="rounded-xl bg-white/40 px-3 py-2 text-xs text-[color:var(--muted-text,#4b5563)] break-words">
          Referral link:{" "}
          <span className="font-semibold text-[color:var(--accent,#111827)]">
            {referralLink}
          </span>
        </div>
      </div>
    </GlassCard>
  );
};

export default PremiumUpsellPanel;
