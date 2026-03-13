import React, { useMemo, useRef, useState } from "react";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import Header from "components/layout/Header";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./welcome.css";
import HeroSection from "./HeroSection";
import FeatureSection from "./FeatureSection";
import ReviewsSection from "./ReviewsSection";
import CTASection from "./CTASection";

function Welcome() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const featureRef = useRef<HTMLElement | null>(null);
  const landingShellRef = useRef<HTMLDivElement | null>(null);

  const referralCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("ref") || "";
  }, [location.search]);

  const [showReferralModal, setShowReferralModal] = useState(
    Boolean(referralCode)
  );

  const scrollToFeatures = () => {
    featureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={landingShellRef}
      className="landing-shell landing-theme app-container min-h-screen flex flex-col bg-[color:var(--bg-color,#0B0F14)] text-[color:var(--text-color,#e5e7eb)]"
      style={
        {
          // Make the sections below the hero match the hero's neutral dark palette
          // (instead of the default slightly blue-tinted surface).
          "--card-bg": "#15191E",
          "--input-bg": "#15191E",
        } as React.CSSProperties
      }
    >
      <div className="landing-animated-bg" aria-hidden="true" />

      <Header />

      <main className="relative z-[1] flex-1 pt-[80px] sm:pt-[96px]">
        {/* Hero (Three.js knowledge constellation) */}
        <HeroSection scrollToFeatures={scrollToFeatures} />

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-12 sm:px-6 lg:px-8">
          {/* Zig-zag Features */}
          <FeatureSection featureRef={featureRef} />

          {/* Reviews */}
          <ReviewsSection />

          {/* CTA */}
          <CTASection />
        </div>
      </main>

      {showReferralModal && referralCode && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4">
          <div className="max-w-md rounded-2xl bg-[color:var(--card-bg,#ffffff)] px-6 py-5 text-[color:var(--text-color,#111827)] shadow-2xl">
            <h2 className="text-lg font-semibold">
              {t("welcome.referral.title", "You were invited to Monevo")}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
              {t(
                "welcome.referral.body",
                "After you complete your first learning path, you and your friend will both receive 40% off the Plus plan by email."
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30 hover:shadow-lg hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                onClick={() => {
                  navigate(`/register?ref=${encodeURIComponent(referralCode)}`);
                }}
              >
                {t("welcome.referral.cta", "Start with your invite")}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] px-4 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                onClick={() => setShowReferralModal(false)}
              >
                {t("welcome.referral.dismiss", "Maybe later")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Welcome;
