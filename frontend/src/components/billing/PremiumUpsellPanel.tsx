import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
const CHECKOUT_URL =
  import.meta.env.VITE_CHECKOUT_URL || "https://pay.garzoni.app/checkout";

const canSendAnalytics = () =>
  typeof window !== "undefined" &&
  typeof window.gtag === "function" &&
  window.__GARZONI_CONSENT__?.analytics;

const trackPremiumEvent = (
  eventName: string,
  payload: Record<string, unknown>
) => {
  if (!canSendAnalytics() || !window.gtag) return;
  window.gtag("event", eventName, {
    send_to: "G-99E61ZXSV9",
    event_category: "premium",
    ...payload,
  });
};

const PremiumUpsellPanel = () => {
  const { t } = useTranslation();
  const { user, loadProfile } = useAuth();
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const appOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.garzoni.app";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileData = await loadProfile();
        if (cancelled) return;
        const profileReferral =
          typeof profileData?.referral_code === "string"
            ? profileData.referral_code
            : typeof (
                  profileData?.user_data as
                    | { referral_code?: string }
                    | undefined
                )?.referral_code === "string"
              ? (
                  profileData?.user_data as
                    | { referral_code?: string }
                    | undefined
                )?.referral_code || ""
              : "";
        setReferralCode(profileReferral);
      } catch {
        if (!cancelled) setReferralCode("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile, user?.id]);

  const referralLink = `${appOrigin}/welcome?ref=${encodeURIComponent(
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
    if (!referralCode) return;
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
      <div className="space-y-3 rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-gradient-to-br from-[color:var(--accent,#ffd700)]/5 via-[color:var(--primary,#1d5330)]/10 to-transparent px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("billing.upgradeToPremium")}
            </p>
            <h4 className="text-base font-semibold text-[color:var(--text-color,#111827)]">
              {t("billing.unlockPremiumFeatures")}
            </h4>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("billing.getUnlimitedAccess")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton variant="active" size="sm" onClick={handleTrialClick}>
            {t("billing.startFreeTrial")}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleReferralClick}
            disabled={!referralCode}
            className={
              referralCopied ? "border-green-500/60 text-green-700" : ""
            }
          >
            {referralCopied ? t("billing.copied") : t("billing.shareReferral")}
          </GlassButton>
        </div>
        <div className="rounded-xl bg-white/50 px-3 py-2 text-xs text-[color:var(--muted-text,#6b7280)]">
          {t("billing.checkoutUrlLabel")}:{" "}
          <span className="font-semibold text-[color:var(--text-color,#111827)]">
            {CHECKOUT_URL.replace(/^https?:\/\//, "")}
          </span>{" "}
          {t("billing.checkoutWithParams")}{" "}
          <code className="font-mono text-[color:var(--text-color,#111827)]">
            ?context=...
          </code>{" "}
          {t("billing.checkoutAnd")}{" "}
          <code className="font-mono text-[color:var(--text-color,#111827)]">
            source=dashboard-upsell
          </code>{" "}
          {t("billing.checkoutAttributionTracking")}
        </div>
        <div className="rounded-xl bg-white/40 px-3 py-2 text-xs text-[color:var(--muted-text,#4b5563)] break-words">
          {t("billing.referralLinkLabel")}:{" "}
          <span className="font-semibold text-[color:var(--text-color,#111827)]">
            {referralCode ? referralLink : t("billing.referralUnavailable")}
          </span>
        </div>
      </div>
    </GlassCard>
  );
};

export default PremiumUpsellPanel;
