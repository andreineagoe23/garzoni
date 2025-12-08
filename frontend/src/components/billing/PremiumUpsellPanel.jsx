import React, { useMemo, useState } from "react";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";

const CHECKOUT_URL =
  process.env.REACT_APP_CHECKOUT_URL ||
  "https://pay.monevo.app/checkout";

const canSendAnalytics = () =>
  typeof window !== "undefined" &&
  typeof window.gtag === "function" &&
  window.Cookiebot?.consent?.statistics;

const trackPremiumEvent = (eventName, payload) => {
  if (!canSendAnalytics()) return;
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
    typeof window !== "undefined" ? window.location.origin : "https://app.monevo.com";

  const referralCode = useMemo(() => {
    if (user?.username) return `${user.username}-invite`;
    if (user?.email) return `${user.email.split("@")[0]}-invite`;
    return "MONEVO-FRIEND";
  }, [user?.email, user?.username]);

  const referralLink = `${appOrigin}/register?ref=${encodeURIComponent(referralCode)}`;

  const frictionPoints = useMemo(
    () => [
      {
        key: "extra-lesson",
        title: "Extra lesson drop",
        insight:
          "Learners who finish a track quickly try to unlock more depth. Offer them weekly premium drops to keep momentum.",
        metric: "Top request after course completion",
      },
      {
        key: "advanced-review",
        title: "Advanced review pack",
        insight:
          "Users re-open quizzes for harder practice but hit a ceiling. Highlight premium review drills when we detect repeat attempts.",
        metric: "High retry volume on quizzes",
      },
      {
        key: "ai-tutor",
        title: "AI tutor follow-ups",
        insight:
          "Chatbot sessions that ask for next steps should surface the AI tutor upgrade with contextual prompts.",
        metric: "Long sessions with unanswered follow-ups",
      },
    ],
    []
  );

  const buildCheckoutLink = (context) => {
    const params = new URLSearchParams({
      context,
      source: "dashboard-upsell",
    });
    return `${CHECKOUT_URL}?${params.toString()}`;
  };

  const handlePremiumClick = (context) => {
    trackPremiumEvent("premium_cta_click", {
      context,
      location: "dashboard_upsell",
    });

    const link = buildCheckoutLink(context);
    window.open(link, "_blank", "noopener,noreferrer");
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
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          Growth signals
        </p>
        <h3 className="text-lg font-bold text-[color:var(--accent,#111827)]">
          Convert friction into Premium wins
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          We track the top places learners ask for more: extra lessons, tougher reviews, and AI tutor depth. Keep them moving with a quick upgrade path.
        </p>
      </div>

      <div className="space-y-4">
        {frictionPoints.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--card-bg,#f8fafc)]/60 px-4 py-4 shadow-inner shadow-black/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {item.title}
                  </span>
                  <span className="rounded-full bg-[color:var(--error,#dc2626)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--error,#dc2626)]">
                    Locked
                  </span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {item.metric}
                </p>
                <p className="text-sm leading-relaxed text-[color:var(--muted-text,#4b5563)]">
                  {item.insight}
                </p>
              </div>
              <GlassButton
                size="sm"
                variant="active"
                className="shrink-0"
                onClick={() => handlePremiumClick(item.key)}
              >
                Try Premium
              </GlassButton>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-gradient-to-br from-[color:var(--primary,#1d5330)]/5 via-[color:var(--primary,#1d5330)]/10 to-transparent px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Quick win offers
            </p>
            <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
              Short trial and referral hooks
            </h4>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              Launch a 7-day trial or share a referral invite. Conversions are tracked in analytics so you can see what works.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <GlassButton variant="active" size="sm" onClick={handleTrialClick}>
            Start 7-day trial
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={handleReferralClick}
            className={referralCopied ? "border-green-500/60 text-green-700" : ""}
          >
            {referralCopied ? "Referral link copied" : "Share referral invite"}
          </GlassButton>
        </div>
        <div className="rounded-xl bg-white/50 px-3 py-2 text-xs text-[color:var(--muted-text,#6b7280)]">
          Checkout links carry context automatically: <span className="font-semibold text-[color:var(--accent,#111827)]">{CHECKOUT_URL.replace(/^https?:\/\//, "")}</span>
          {" "}will receive <code className="font-mono text-[color:var(--accent,#111827)]">?context=...</code> + <code className="font-mono text-[color:var(--accent,#111827)]">source=dashboard-upsell</code> for attribution.
        </div>
        <div className="rounded-xl bg-white/40 px-3 py-2 text-xs text-[color:var(--muted-text,#4b5563)] break-words">
          Referral link preview: <span className="font-semibold text-[color:var(--accent,#111827)]">{referralLink}</span>
        </div>
      </div>
    </GlassCard>
  );
};

export default PremiumUpsellPanel;
