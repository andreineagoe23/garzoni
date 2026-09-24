import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import CompoundDemo from "./home/CompoundDemo";
import DownloadBand from "./home/DownloadBand";
import HeroSection from "./home/HeroSection";
import HowItWorks from "./home/HowItWorks";
import LandingFooter from "./home/LandingFooter";
import LandingHeader from "./home/LandingHeader";
import PricingSection from "./home/PricingSection";
import TopicMarquee from "./home/TopicMarquee";
import "./home/home.css";

const DOWNLOAD_ID = "download";
/** Clears the sticky header when scrolling to the download band. */
const HEADER_OFFSET = 80;

function Welcome() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const goDownload = useCallback(() => {
    const el = document.getElementById(DOWNLOAD_ID);
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET,
      behavior: "smooth",
    });
  }, []);

  const referralCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("ref") || "";
  }, [location.search]);

  const [showReferralModal, setShowReferralModal] = useState(
    Boolean(referralCode)
  );

  useEffect(() => {
    if (referralCode) {
      import("utils/pendingReferral").then(({ savePendingReferralCode }) => {
        savePendingReferralCode(referralCode);
      });
    }
  }, [referralCode]);

  return (
    <>
      <Helmet>
        <title>{t("welcome.seo.title")}</title>
        <meta name="description" content={t("welcome.seo.description")} />
      </Helmet>

      <div className="gzh" data-theme="dark">
        <div className="gzh-glow" aria-hidden="true" />
        <LandingHeader onGetApp={goDownload} />
        <main className="gzh-main">
          <HeroSection />
          <TopicMarquee />
          <HowItWorks />
          <CompoundDemo />
          <PricingSection onChoosePlan={goDownload} />
          <DownloadBand id={DOWNLOAD_ID} />
        </main>
        <LandingFooter />
      </div>

      {/* Referral modal */}
      {showReferralModal && referralCode && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 px-4">
          <div className="max-w-md rounded-2xl bg-[#111827] border border-white/10 px-6 py-5 text-[#e5e7eb] shadow-2xl">
            <h2 className="text-lg font-semibold">
              {t("welcome.referral.title")}
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: "rgba(229,231,235,0.72)" }}
            >
              {t("welcome.referral.body")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(`/register?ref=${encodeURIComponent(referralCode)}`)
                }
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "100px",
                  background:
                    "linear-gradient(180deg, var(--primary-bright,#2a7347), var(--primary,#1d5330))",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Start with your invite
              </button>
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "100px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(229,231,235,0.72)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Welcome;
