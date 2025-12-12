// PaymentRequired.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GlassButton, GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
import { recordFunnelEvent } from "services/analyticsService";

const CHECKOUT_URL =
  process.env.REACT_APP_CHECKOUT_URL || "https://pay.monevo.app/checkout";

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

const PaymentRequired = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    entitlements,
    entitlementError,
    entitlementSupportLink,
    reloadEntitlements,
    loadProfile,
  } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState({
    hasPaid: false,
    questionnaireComplete: false,
  });

  const fetchSubscriptionInfo = useCallback(async () => {
    try {
      const profilePayload = await loadProfile();
      const userData = profilePayload?.user_data || profilePayload || {};
      setSubscriptionInfo({
        hasPaid: Boolean(userData?.has_paid),
        questionnaireComplete: Boolean(userData?.is_questionnaire_completed),
      });
    } catch (error) {
      console.error("Error fetching subscription info:", error);
    }
  }, [loadProfile]);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [fetchSubscriptionInfo]);

  const handleSubscriptionNavigate = useCallback(() => {
    if (!subscriptionInfo.questionnaireComplete) {
      navigate("/questionnaire");
      return;
    }
    if (!subscriptionInfo.hasPaid) {
      navigate("/upgrade", { state: { from: "/upgrade" } });
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
      source: "upgrade-page",
    });
    return `${CHECKOUT_URL}?${params.toString()}`;
  };

  const handlePremiumClick = (context) => {
    trackPremiumEvent("premium_cta_click", {
      context,
      location: "upgrade_page",
    });

    const link = buildCheckoutLink(context);
    window.open(link, "_blank", "noopener,noreferrer");
  };

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
              Start the upgrade flow to pick a plan, answer a quick
              questionnaire, and complete checkout. We’ll keep you signed in and
              redirect you back to your tailored learning path after payment.
            </p>
            {upgradeComplete && (
              <p className="rounded-lg bg-[color:var(--success,#16a34a)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--success,#16a34a)]">
                Payment confirmed! Click below to continue to your personalized
                path.
              </p>
            )}
            {entitlements?.fallback && (
              <p className="rounded-lg bg-[color:var(--warning,#facc15)]/20 px-3 py-2 text-xs text-[color:var(--accent,#92400e)]">
                We could not confirm your subscription status. You are
                temporarily in free mode while we retry.
              </p>
            )}
            {entitlementError && (
              <p className="text-sm text-[color:var(--error,#dc2626)]">
                {entitlementError}
              </p>
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
                {upgradeComplete
                  ? "Continue to your path"
                  : "Start with Questionnaire"}
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

        {/* Growth Signals Section - Horizontal Layout */}
        <GlassCard padding="lg" className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Growth signals
            </p>
            <h3 className="text-lg font-bold text-[color:var(--accent,#111827)]">
              Convert friction into Premium wins
            </h3>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              We track the top places learners ask for more: extra lessons,
              tougher reviews, and AI tutor depth. Keep them moving with a quick
              upgrade path.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {frictionPoints.map((item) => (
              <div
                key={item.key}
                className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--card-bg,#f8fafc)]/60 px-4 py-4 shadow-inner shadow-black/5"
              >
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
                  className="mt-auto"
                  onClick={() => handlePremiumClick(item.key)}
                >
                  Try Premium
                </GlassButton>
              </div>
            ))}
          </div>
        </GlassCard>
      </GlassCard>
    </section>
  );
};

export default PaymentRequired;
