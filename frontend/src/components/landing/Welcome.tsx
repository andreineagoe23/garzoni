import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { garzoniDemoPosterUrl, garzoniDemoVideoUrl } from "@garzoni/core";
import Header from "components/layout/Header";
import { GlassContainer, Modal } from "components/ui";
import { useTheme } from "contexts/ThemeContext";
import apiClient from "services/httpClient";
import { formatCurrency, getLocale } from "utils/format";
import ParticleStage from "./ParticleStage";
import "./marketing.css";
import "./welcome.css";

// ── Live pricing (public /plans/ catalog) ──────────────────────────────────
type LandingPlan = {
  plan_id: string;
  billing_interval: string;
  price_amount?: number | string;
  currency?: string;
  promo_price_amount?: number | null;
};
type LandingPromo = { id: string; percent_off: number; ends_on: string };

type TierPricing = {
  monthly: number;
  yearly: number;
  currency: string;
  savingsPct: number;
  monthlyPromo: number | null;
  yearlyPromo: number | null;
};

// Real catalog fallback (used only if the /plans/ fetch fails). Kept in sync
// with backend/authentication/entitlements.py — corrected from stale £5.00/£5.83.
const FALLBACK_PRICING: Record<"plus" | "pro", TierPricing> = {
  plus: {
    monthly: 6.99,
    yearly: 59.99,
    currency: "GBP",
    savingsPct: 28,
    monthlyPromo: null,
    yearlyPromo: null,
  },
  pro: {
    monthly: 7.99,
    yearly: 69.99,
    currency: "GBP",
    savingsPct: 27,
    monthlyPromo: null,
    yearlyPromo: null,
  },
};

const computeSavingsPct = (monthly: number, yearly: number): number => {
  if (!monthly || !yearly) return 0;
  const pct = Math.round((1 - yearly / (monthly * 12)) * 100);
  return pct > 0 ? pct : 0;
};

const PUBLIC_PAGES = [
  { to: "/marketing", label: "Features", emoji: "✨" },
  { to: "/subscriptions", label: "Pricing", emoji: "💳" },
  { to: "/support", label: "Support", emoji: "❓" },
  { to: "/privacy-policy", label: "Privacy Policy", emoji: "🔒" },
  { to: "/terms-of-service", label: "Terms of Service", emoji: "📋" },
  { to: "/cookie-policy", label: "Cookie Policy", emoji: "🍪" },
];

const FAQ_ITEMS = [
  {
    q: "Is it really free to start?",
    a: "Yes. The Starter plan is free forever — no card needed. You get the full lesson library, daily streaks, XP, and basic calculators from day one.",
  },
  {
    q: "What will I actually learn?",
    a: "Budgeting, debt management, saving strategies, investing basics, credit scores, and taxes — all broken into ten-minute lessons with spaced repetition so knowledge sticks.",
  },
  {
    q: "How does the AI coach work?",
    a: "The AI coach reads your inputs in simulators (budget, debt payoff, savings goals) and narrates what changes and why in plain language. It personalises explanations to your goals.",
  },
  {
    q: "Is Garzoni financial advice?",
    a: "No. Garzoni is a financial education app. We explain concepts and run simulations — we don't recommend specific products and we're not a registered financial adviser.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Subscriptions are managed through your Apple ID — cancel in one tap from Settings. You keep premium features until the end of the billing period.",
  },
  {
    q: "What languages are supported?",
    a: "English at launch, with French, Spanish and Italian rolling out in following quarters.",
  },
];

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="8" fill="rgba(29,83,48,0.2)" />
    <path
      d="M4 8.2l2.5 2.5 5.5-6"
      stroke="#2a7347"
      strokeWidth="1.7"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const GreenCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="7" fill="rgba(29,83,48,0.2)" />
    <path
      d="M4 7.2l2 2 4-4.5"
      stroke="#2a7347"
      strokeWidth="1.7"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const GoldCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="7" fill="rgba(230,200,122,0.15)" />
    <path
      d="M4 7.2l2 2 4-4.5"
      stroke="#e6c87a"
      strokeWidth="1.7"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

function Welcome() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const demoVideoUrl = garzoniDemoVideoUrl();
  const demoPosterUrl = garzoniDemoPosterUrl();
  const pagesButtonRef = useRef<HTMLButtonElement>(null);
  const pagesDropdownRef = useRef<HTMLDivElement>(null);

  // Particle globe refs
  const brainStageRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const topicRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);
  const flowRef = useRef(0.15);

  useLayoutEffect(() => {
    if (!pagesOpen) return;
    const updatePos = () => {
      const btn = pagesButtonRef.current;
      const panel = pagesDropdownRef.current;
      if (!btn || !panel) return;
      const r = btn.getBoundingClientRect();
      panel.style.top = `${Math.round(r.bottom + 8)}px`;
      panel.style.left = `${Math.round(r.left)}px`;
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    document.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      document.removeEventListener("scroll", updatePos, true);
    };
  }, [pagesOpen]);

  useEffect(() => {
    if (!pagesOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (
        pagesButtonRef.current?.contains(e.target as Node) ||
        pagesDropdownRef.current?.contains(e.target as Node)
      )
        return;
      setPagesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPagesOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [pagesOpen]);

  // Live pricing from the public catalog; falls back to the corrected numbers.
  const [pricingPlans, setPricingPlans] = useState<LandingPlan[]>([]);
  const [pricingPromo, setPricingPromo] = useState<LandingPromo | null>(null);
  const priceLocale = getLocale();

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(apiClient.get("/plans/"))
      .then((r) => {
        if (cancelled) return;
        setPricingPlans(r?.data?.plans || []);
        setPricingPromo(r?.data?.promo || null);
      })
      .catch(() => {
        // Keep fallback pricing on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pricing = useMemo<Record<"plus" | "pro", TierPricing>>(() => {
    const build = (planId: "plus" | "pro"): TierPricing => {
      const monthly = pricingPlans.find(
        (p) => p.plan_id === planId && p.billing_interval === "monthly"
      );
      const yearly = pricingPlans.find(
        (p) => p.plan_id === planId && p.billing_interval === "yearly"
      );
      const monthlyPrice = Number(monthly?.price_amount ?? NaN);
      const yearlyPrice = Number(yearly?.price_amount ?? NaN);
      if (!Number.isFinite(monthlyPrice) || !Number.isFinite(yearlyPrice)) {
        return FALLBACK_PRICING[planId];
      }
      const promoActive = !!pricingPromo;
      return {
        monthly: monthlyPrice,
        yearly: yearlyPrice,
        currency: monthly?.currency || yearly?.currency || "GBP",
        savingsPct: computeSavingsPct(monthlyPrice, yearlyPrice),
        monthlyPromo:
          promoActive && monthly?.promo_price_amount != null
            ? Number(monthly.promo_price_amount)
            : null,
        yearlyPromo:
          promoActive && yearly?.promo_price_amount != null
            ? Number(yearly.promo_price_amount)
            : null,
      };
    };
    return { plus: build("plus"), pro: build("pro") };
  }, [pricingPlans, pricingPromo]);

  const fmtPrice = (value: number, currency: string) =>
    formatCurrency(value, currency, priceLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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
        <title>Garzoni | Personal Finance Education</title>
        <meta
          name="description"
          content="Garzoni teaches you money the way you learn a language — ten-minute lessons, daily streaks, and AI-guided tools."
        />
        {/* Fonts are self-hosted via Fontsource (src/styles/fonts.css). */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
              },
            })),
          })}
        </script>
      </Helmet>

      <div className={`mkt${darkMode ? "" : " mkt-light"}`}>
        <Header />

        {/* ————————————— HERO ————————————— */}
        <header className="hero" style={{ paddingTop: "160px" }}>
          <div className="wrap hero-inner">
            <div>
              <div className="eyebrow">Personal finance, rewired</div>
              <h1>
                Finance that <em className="em-gold">actually sticks</em>.
              </h1>
              <p className="lede">
                Garzoni teaches you money the way you learn a language —
                ten-minute lessons, daily streaks, and AI-guided tools that let
                you practice the decisions that matter.
              </p>
              <div className="hero-cta-grid" style={{ marginBottom: "4px" }}>
                <a
                  href="https://apps.apple.com/gb/app/garzoni-personal-finance/id6761790801"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-store"
                >
                  {/* Official Apple logo */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="#fff"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      textAlign: "left",
                    }}
                  >
                    <span className="btn-store-caption">Download on the</span>
                    <span className="btn-store-main">App Store</span>
                  </div>
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=app.garzoni.mobile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-store"
                >
                  {/* Google Play logo */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="#fff"
                  >
                    <path d="M5 4v16a1 1 0 0 0 1.53.85l13-8a1 1 0 0 0 0-1.7l-13-8A1 1 0 0 0 5 4z" />
                  </svg>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      textAlign: "left",
                    }}
                  >
                    <span className="btn-store-caption">Download on the</span>
                    <span className="btn-store-main">Google Play</span>
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => setIsDemoOpen(true)}
                  className="explore-btn"
                  aria-label="Watch the Garzoni demo video"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    height: "40px",
                    padding: "0 18px",
                    borderRadius: "100px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted, var(--muted-text, #6b7280))",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "border-color 0.2s, color 0.2s",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M4.5 3.2a.7.7 0 0 1 1.06-.6l7 4.8a.7.7 0 0 1 0 1.2l-7 4.8a.7.7 0 0 1-1.06-.6V3.2z" />
                  </svg>
                  Watch demo
                </button>
                <button
                  ref={pagesButtonRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={pagesOpen}
                  onClick={() => setPagesOpen((o) => !o)}
                  className="explore-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    height: "40px",
                    padding: "0 18px",
                    borderRadius: "100px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted, var(--muted-text, #6b7280))",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "border-color 0.2s, color 0.2s",
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="9"
                      y="1"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="1"
                      y="9"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="9"
                      y="9"
                      width="5"
                      height="5"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                  </svg>
                  Explore pages
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                    style={{
                      transition: "transform 0.2s",
                      transform: pagesOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <path
                      d="M2 3.5l3 3 3-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                {pagesOpen &&
                  createPortal(
                    <div
                      ref={pagesDropdownRef}
                      style={{
                        position: "fixed",
                        zIndex: 1300,
                        width: "200px",
                      }}
                    >
                      <GlassContainer
                        variant="default"
                        role="menu"
                        className="w-full rounded-2xl py-2"
                      >
                        {PUBLIC_PAGES.map((page) => (
                          <NavLink
                            key={page.to}
                            to={page.to}
                            role="menuitem"
                            onClick={() => setPagesOpen(false)}
                            className={({ isActive }) =>
                              `flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                                isActive
                                  ? "bg-[color:var(--primary,#1d5330)]/20 text-[color:var(--accent,#ffd700)]"
                                  : "text-content-primary hover:bg-white/[0.06]"
                              }`
                            }
                          >
                            <span>{page.emoji}</span>
                            {page.label}
                          </NavLink>
                        ))}
                      </GlassContainer>
                    </div>,
                    document.body
                  )}
              </div>

              <div className="hero-meta">
                <div>
                  <strong>
                    5.0
                    <em
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--gold-warm)",
                        fontStyle: "italic",
                        fontWeight: 400,
                      }}
                    >
                      ★
                    </em>
                  </strong>
                  <span>App Store</span>
                </div>
                <div>
                  <strong>12k+</strong>
                  <span>Learners</span>
                </div>
                <div>
                  <strong>84%</strong>
                  <span>Keep a streak</span>
                </div>
              </div>
            </div>

            {/* Hero right — particle globe */}
            <div className="relative flex items-stretch py-2 sm:py-4 lg:py-0 lg:min-h-[580px]">
              <div
                ref={brainStageRef}
                className={`relative w-full overflow-hidden h-[420px] sm:h-[520px] lg:min-h-[580px]${darkMode ? "" : " welcome-hero--light"}`}
              >
                <div
                  ref={canvasContainerRef}
                  className="absolute inset-0 z-0"
                  aria-hidden="true"
                >
                  <ParticleStage
                    canvasContainerRef={canvasContainerRef}
                    brainStageRef={brainStageRef}
                    topicRefs={topicRefs}
                    lineRefs={lineRefs}
                    flowRef={flowRef}
                    lightBackdrop={!darkMode}
                  />
                </div>

                <svg
                  ref={svgRef}
                  id="tracker-lines"
                  aria-hidden="true"
                  className="transition-opacity duration-300"
                  style={{ opacity: 1 }}
                >
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <line
                      key={idx}
                      ref={(el) => {
                        lineRefs.current[idx] = el;
                      }}
                      className={[
                        "welcome-svg-line",
                        idx === 2 ? "active" : "",
                      ].join(" ")}
                    />
                  ))}
                </svg>

                <div
                  className={`welcome-trackers transition-opacity duration-300${darkMode ? "" : " welcome-hero--light"}`}
                  aria-hidden="true"
                  style={{ opacity: 1 }}
                >
                  {(
                    [
                      "budgeting",
                      "saving",
                      "investing",
                      "credit",
                      "taxes",
                    ] as const
                  ).map((topic) => (
                    <div
                      key={topic}
                      className="welcome-point-marker"
                      ref={(el) => {
                        topicRefs.current[topic] = el;
                      }}
                    >
                      <div className="welcome-point-dot" />
                      <div className="welcome-point-corner welcome-pc-tl" />
                      <div className="welcome-point-corner welcome-pc-br" />
                      <div className="welcome-point-label">
                        {topic.charAt(0).toUpperCase() + topic.slice(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ————————————— FEATURES ————————————— */}
        <section className="section" id="features">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">What does Garzoni actually teach?</div>
              <h2>
                The <em className="em-gold">Duolingo for finance</em> — turning{" "}
                <em className="em-gold">knowing</em> into{" "}
                <em className="em-gold">doing</em>.
              </h2>
              <p>
                Garzoni teaches money the way Duolingo teaches languages: three
                layers working together — the daily habit, the guided lessons,
                and the AI-powered simulators that let you pressure-test real
                decisions.
              </p>
            </div>
            <div className="features">
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M11 2l2.7 5.5L20 8.5l-4.5 4.4 1 6.1L11 16l-5.5 3 1-6.1L2 8.5l6.3-1z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                    />
                  </svg>
                </div>
                <h3>Daily streaks & XP</h3>
                <p>
                  Ten-minute lessons with spaced repetition. A visible streak
                  and XP ladder keep you coming back without a grind.
                </p>
                <div className="feat-visual">
                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      width: "100%",
                      alignItems: "end",
                    }}
                  >
                    {[14, 22, 30, 22, 18, 12, 8].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${h}px`,
                          borderRadius: "3px",
                          background:
                            i === 2
                              ? "var(--primary)"
                              : i < 2
                                ? "var(--primary-soft)"
                                : "var(--ghost)",
                          border:
                            i < 2 ? "1px solid rgba(42,115,71,0.4)" : "none",
                          boxShadow:
                            i === 2 ? "0 0 12px rgba(42,115,71,0.4)" : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M11 2v4M11 16v4M2 11h4M16 11h4M4.5 4.5l2.8 2.8M14.7 14.7l2.8 2.8M4.5 17.5l2.8-2.8M14.7 7.3l2.8-2.8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="11"
                      cy="11"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </div>
                <h3>AI-guided tools</h3>
                <p>
                  Budget builder, debt simulator, savings projections and an
                  always-on AI coach that explains the math in plain language.
                </p>
                <div className="feat-visual">
                  <svg
                    viewBox="0 0 240 80"
                    style={{ width: "100%", height: "100%" }}
                  >
                    <path
                      d="M0 60 Q40 50 60 38 T120 24 T180 12 T240 4"
                      stroke="#2a7347"
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <path
                      d="M0 60 Q40 50 60 38 T120 24 T180 12 T240 4 L240 80 L0 80 Z"
                      fill="rgba(42,115,71,0.15)"
                    />
                    <circle cx="180" cy="12" r="4" fill="#e6c87a" />
                    <circle
                      cx="180"
                      cy="12"
                      r="8"
                      fill="rgba(230,200,122,0.2)"
                    />
                  </svg>
                </div>
              </div>

              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M3 19 L8 13 L12 16 L16 9 L21 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="21" cy="4" r="2" fill="currentColor" />
                  </svg>
                </div>
                <h3>Personalised path</h3>
                <p>
                  Tell us your top money goal. Garzoni rearranges lessons,
                  challenges and calculators around the one thing you're trying
                  to move.
                </p>
                <div className="feat-visual">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "7px",
                      width: "100%",
                    }}
                  >
                    {[
                      { label: "Grow savings", active: true },
                      { label: "Pay down debt", active: false },
                      { label: "Invest", active: false },
                    ].map(({ label, active }) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "5px",
                            background: active
                              ? "var(--gold)"
                              : "var(--primary-soft)",
                            boxShadow: active ? "0 0 8px var(--gold)" : "none",
                            border: active
                              ? "none"
                              : "1px solid rgba(42,115,71,0.4)",
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            height: "3px",
                            background: active
                              ? "var(--primary-bright)"
                              : "var(--ghost)",
                            borderRadius: "2px",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "10px",
                            color: active ? "var(--muted)" : "var(--faint)",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ————————————— STORY ————————————— */}
        <section className="section" style={{ paddingTop: "40px" }}>
          <div className="wrap">
            <div className="story">
              <div className="split">
                <div className="split-copy">
                  <div className="eyebrow">Built for the commute</div>
                  <h3>
                    Ten minutes a day. <em className="em-gold">That's it.</em>
                  </h3>
                  <p>
                    Each lesson is engineered for a single train ride or coffee
                    break. No dense PDFs, no spreadsheets to wrangle. Just one
                    concept, a worked example, and a three-question check.
                  </p>
                  <ul className="check-list">
                    <li>
                      <CheckIcon />
                      Spaced repetition tuned to your memory
                    </li>
                    <li>
                      <CheckIcon />
                      Haptic-friendly, offline-first
                    </li>
                    <li>
                      <CheckIcon />
                      Progress syncs across devices
                    </li>
                  </ul>
                </div>
                <div className="split-device">
                  <div className="mini-device">
                    <div className="mini-screen">
                      <div className="onb-progress">
                        <div className="onb-bar" />
                        <span>1 / 6</span>
                      </div>
                      <div className="onb-eyebrow">
                        Personalise your journey
                      </div>
                      <div className="onb-head">
                        What's your <em className="em-gold">top</em> money goal?
                      </div>
                      <div className="onb-grid">
                        {[
                          {
                            icon: (
                              <rect
                                x="3"
                                y="13"
                                width="4"
                                height="6"
                                rx="1"
                                fill="#2a7347"
                              />
                            ),
                            label: "Build a budget",
                            sub: "Know where it goes",
                            sel: false,
                          },
                          {
                            icon: (
                              <circle
                                cx="11"
                                cy="9"
                                r="6"
                                stroke="#2a7347"
                                strokeWidth="1.4"
                                fill="none"
                                opacity="0.5"
                              />
                            ),
                            label: "Pay down debt",
                            sub: "Shrink balances",
                            sel: false,
                          },
                          {
                            icon: (
                              <ellipse
                                cx="11"
                                cy="7"
                                rx="7"
                                ry="2"
                                stroke="#e5e7eb"
                                strokeWidth="1.2"
                                fill="rgba(229,231,235,0.35)"
                              />
                            ),
                            label: "Grow savings",
                            sub: "Build a cushion",
                            sel: true,
                          },
                          {
                            icon: (
                              <path
                                d="M3 18 L8 12 L12 15 L16 8 L20 4"
                                stroke="#2a7347"
                                strokeWidth="1.6"
                                fill="none"
                                strokeLinecap="round"
                              />
                            ),
                            label: "Start investing",
                            sub: "Money to work",
                            sel: false,
                          },
                        ].map(({ label, sub, sel }) => (
                          <div
                            key={label}
                            className={`onb-card${sel ? " sel" : ""}`}
                          >
                            <div className="onb-card-icon">
                              <svg width="14" height="14" viewBox="0 0 22 22">
                                {sel ? (
                                  <>
                                    <ellipse
                                      cx="11"
                                      cy="17"
                                      rx="7"
                                      ry="2"
                                      stroke="#e5e7eb"
                                      strokeWidth="1.2"
                                      fill="rgba(229,231,235,0.15)"
                                    />
                                    <ellipse
                                      cx="11"
                                      cy="12"
                                      rx="7"
                                      ry="2"
                                      stroke="#e5e7eb"
                                      strokeWidth="1.2"
                                      fill="rgba(229,231,235,0.25)"
                                    />
                                    <ellipse
                                      cx="11"
                                      cy="7"
                                      rx="7"
                                      ry="2"
                                      stroke="#e5e7eb"
                                      strokeWidth="1.2"
                                      fill="rgba(229,231,235,0.35)"
                                    />
                                  </>
                                ) : label === "Build a budget" ? (
                                  <>
                                    <rect
                                      x="3"
                                      y="13"
                                      width="4"
                                      height="6"
                                      rx="1"
                                      fill="#2a7347"
                                    />
                                    <rect
                                      x="9"
                                      y="9"
                                      width="4"
                                      height="10"
                                      rx="1"
                                      fill="#2a7347"
                                      opacity="0.7"
                                    />
                                    <rect
                                      x="15"
                                      y="5"
                                      width="4"
                                      height="14"
                                      rx="1"
                                      fill="#2a7347"
                                      opacity="0.5"
                                    />
                                  </>
                                ) : label === "Pay down debt" ? (
                                  <>
                                    <circle
                                      cx="11"
                                      cy="9"
                                      r="6"
                                      stroke="#2a7347"
                                      strokeWidth="1.4"
                                      fill="none"
                                      opacity="0.5"
                                    />
                                    <path
                                      d="M11 4v10M7 10l4 4 4-4"
                                      stroke="#2a7347"
                                      strokeWidth="1.6"
                                      fill="none"
                                      strokeLinecap="round"
                                    />
                                  </>
                                ) : (
                                  <>
                                    <path
                                      d="M3 18 L8 12 L12 15 L16 8 L20 4"
                                      stroke="#2a7347"
                                      strokeWidth="1.6"
                                      fill="none"
                                      strokeLinecap="round"
                                    />
                                    <circle
                                      cx="20"
                                      cy="4"
                                      r="1.8"
                                      fill="#2a7347"
                                    />
                                  </>
                                )}
                              </svg>
                            </div>
                            <h4>{label}</h4>
                            <span>{sub}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="split reverse">
                <div className="split-copy">
                  <div className="eyebrow">Practice, not theory</div>
                  <h3>
                    Simulators for the <em className="em-gold">decisions</em>{" "}
                    that matter.
                  </h3>
                  <p>
                    Model a debt payoff plan. Project ten years of savings.
                    Stress-test a budget against a rent hike. The AI coach
                    narrates what changes and why — so the lesson sticks past
                    the screen.
                  </p>
                  <ul className="check-list">
                    <li>
                      <CheckIcon />
                      Debt payoff simulator (avalanche or snowball)
                    </li>
                    <li>
                      <CheckIcon />
                      10-year savings projection
                    </li>
                    <li>
                      <CheckIcon />
                      Budget stress-tests with AI commentary
                    </li>
                  </ul>
                </div>
                <div className="split-device">
                  <div className="mini-device">
                    <div className="mini-screen" style={{ paddingTop: "54px" }}>
                      <div
                        className="onb-eyebrow"
                        style={{ marginBottom: "14px" }}
                      >
                        Calculator · AI
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontStyle: "italic",
                          fontSize: "14px",
                          color: "var(--muted)",
                          marginBottom: "2px",
                        }}
                      >
                        Monthly budget
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "44px",
                          letterSpacing: "-1px",
                          lineHeight: "1.05",
                          marginBottom: "18px",
                        }}
                      >
                        $2,840
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "2px",
                          height: "6px",
                          borderRadius: "3px",
                          overflow: "hidden",
                          marginBottom: "10px",
                        }}
                      >
                        <div style={{ flex: 42, background: "#2a7347" }} />
                        <div
                          style={{
                            flex: 28,
                            background: "#e6c87a",
                            opacity: 0.7,
                          }}
                        />
                        <div style={{ flex: 30, background: "var(--ghost)" }} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "10px",
                          color: "var(--muted)",
                          marginBottom: "24px",
                        }}
                      >
                        <span>Needs 42%</span>
                        <span>Wants 28%</span>
                        <span>Save 30%</span>
                      </div>
                      <div
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "14px",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "8px",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <path
                              d="M5 0l1.2 3.3L10 5l-3.8 1.7L5 10l-1.2-3.3L0 5l3.8-1.7z"
                              fill="#2a7347"
                            />
                          </svg>
                          <span
                            style={{
                              fontSize: "9px",
                              color: "#2a7347",
                              fontWeight: 600,
                              letterSpacing: "0.6px",
                              textTransform: "uppercase",
                            }}
                          >
                            AI Insight
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            lineHeight: 1.5,
                            color: "var(--muted)",
                          }}
                        >
                          Bump savings to 35% and you'll hit your cushion goal
                          five months sooner.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ————————————— PRICING ————————————— */}
        <section className="section" id="pricing">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Pricing</div>
              <h2>
                Honest, <em className="em-gold">cancel-anytime</em> pricing.
              </h2>
              <p>
                Start free and stay free — or upgrade when you're ready for
                deeper tools. Annual plans save up to 28%.
              </p>
            </div>
            <div className="pricing">
              <div className="price-card">
                <div className="price-tier-row">
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "4px",
                      background: "var(--ghost)",
                    }}
                  />
                  <h3>Starter</h3>
                </div>
                <div className="price-tagline">Begin the habit</div>
                <div className="price-main">
                  <span className="val">£0</span>
                  <span className="unit">forever</span>
                </div>
                <div className="price-sub">No card needed</div>
                <ul className="price-perks">
                  <li>
                    <GreenCheckIcon />
                    Full lesson library
                  </li>
                  <li>
                    <GreenCheckIcon />
                    Daily streaks & XP
                  </li>
                  <li>
                    <GreenCheckIcon />
                    Basic calculators
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="price-cta default"
                >
                  Get Starter
                </button>
              </div>

              <div className="price-card">
                <div className="price-tier-row">
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "4px",
                      background: "var(--primary-bright)",
                      boxShadow: "0 0 8px var(--primary-bright)",
                    }}
                  />
                  <h3>Plus</h3>
                </div>
                <div className="price-tagline">A personalised path</div>
                <div className="price-main">
                  {pricing.plus.monthlyPromo != null && (
                    <span
                      className="val"
                      style={{
                        textDecoration: "line-through",
                        opacity: 0.5,
                        marginRight: "8px",
                        fontWeight: 600,
                      }}
                    >
                      {fmtPrice(pricing.plus.monthly, pricing.plus.currency)}
                    </span>
                  )}
                  <span className="val">
                    {fmtPrice(
                      pricing.plus.monthlyPromo ?? pricing.plus.monthly,
                      pricing.plus.currency
                    )}
                  </span>
                  <span className="unit">/ month</span>
                </div>
                <div className="price-sub">
                  Billed{" "}
                  {pricing.plus.yearlyPromo != null ? (
                    <>
                      <span
                        style={{ textDecoration: "line-through", opacity: 0.6 }}
                      >
                        {fmtPrice(pricing.plus.yearly, pricing.plus.currency)}
                      </span>{" "}
                      {fmtPrice(
                        pricing.plus.yearlyPromo,
                        pricing.plus.currency
                      )}
                    </>
                  ) : (
                    fmtPrice(pricing.plus.yearly, pricing.plus.currency)
                  )}{" "}
                  annually · save {pricing.plus.savingsPct}%
                </div>
                <ul className="price-perks">
                  <li>
                    <GreenCheckIcon />
                    Personalised learning path
                  </li>
                  <li>
                    <GreenCheckIcon />
                    Unlimited calculators
                  </li>
                  <li>
                    <GreenCheckIcon />
                    Progress insights
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => navigate("/subscriptions")}
                  className="price-cta green"
                >
                  Start Plus
                </button>
              </div>

              <div className="price-card pro">
                <div className="price-badge">Recommended</div>
                <div className="price-tier-row">
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "4px",
                      background: "var(--gold)",
                      boxShadow: "0 0 8px var(--gold)",
                    }}
                  />
                  <h3>Pro</h3>
                </div>
                <div className="price-tagline">The full toolkit</div>
                <div className="price-main">
                  {pricing.pro.monthlyPromo != null && (
                    <span
                      className="val"
                      style={{
                        textDecoration: "line-through",
                        opacity: 0.5,
                        marginRight: "8px",
                        fontWeight: 600,
                      }}
                    >
                      {fmtPrice(pricing.pro.monthly, pricing.pro.currency)}
                    </span>
                  )}
                  <span className="val">
                    {fmtPrice(
                      pricing.pro.monthlyPromo ?? pricing.pro.monthly,
                      pricing.pro.currency
                    )}
                  </span>
                  <span className="unit">/ month</span>
                </div>
                <div className="price-sub">
                  Billed{" "}
                  {pricing.pro.yearlyPromo != null ? (
                    <>
                      <span
                        style={{ textDecoration: "line-through", opacity: 0.6 }}
                      >
                        {fmtPrice(pricing.pro.yearly, pricing.pro.currency)}
                      </span>{" "}
                      {fmtPrice(pricing.pro.yearlyPromo, pricing.pro.currency)}
                    </>
                  ) : (
                    fmtPrice(pricing.pro.yearly, pricing.pro.currency)
                  )}{" "}
                  annually · save {pricing.pro.savingsPct}%
                </div>
                <ul className="price-perks">
                  <li>
                    <GoldCheckIcon />
                    Everything in Plus
                  </li>
                  <li>
                    <GoldCheckIcon />
                    Advanced simulations
                  </li>
                  <li>
                    <GoldCheckIcon />
                    Priority AI guidance
                  </li>
                  <li>
                    <GoldCheckIcon />
                    Early access to new tools
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => navigate("/subscriptions")}
                  className="price-cta gold"
                >
                  Start Pro
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ————————————— QUOTE ————————————— */}
        <section className="quote-wrap">
          <div className="wrap quote">
            <div className="eyebrow" style={{ marginBottom: "24px" }}>
              What users say
            </div>
            <blockquote>
              "I'd read three personal-finance books and retained{" "}
              <em>nothing.</em> Two weeks on Garzoni and I finally understand
              what my own money is doing."
            </blockquote>
            <div className="quote-author">
              <strong>Léa M.</strong> — Early user, Paris
            </div>
          </div>
        </section>

        {/* ————————————— FAQ ————————————— */}
        <section
          className="section"
          id="support"
          style={{ paddingTop: "40px" }}
        >
          <div className="wrap">
            <div
              className="section-head"
              style={{ margin: "0 auto 60px", textAlign: "center" }}
            >
              <div className="eyebrow" style={{ textAlign: "center" }}>
                Frequently asked
              </div>
              <h2 style={{ marginTop: "14px" }}>
                Good questions. <em className="em-gold">Straight answers.</em>
              </h2>
            </div>
            <div className="faq">
              {FAQ_ITEMS.map((item, i) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  className={`faq-item${openFaq === i ? " open" : ""}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  onKeyDown={(e) =>
                    e.key === "Enter" || e.key === " "
                      ? setOpenFaq(openFaq === i ? null : i)
                      : undefined
                  }
                >
                  <div className="faq-q">
                    {item.q}
                    <span className="sigil">+</span>
                  </div>
                  <div className="faq-a">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ————————————— CTA ————————————— */}
        <section style={{ padding: "80px 0 120px" }}>
          <div className="wrap" style={{ textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: "24px" }}>
              Ready to start?
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: "48px",
                letterSpacing: "-1.2px",
                lineHeight: "1.05",
                margin: "0 0 20px",
              }}
            >
              Your path to financial <em className="em-gold">mastery</em> starts
              here.
            </h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "17px",
                lineHeight: "1.6",
                marginBottom: "36px",
              }}
            >
              Free to start. No credit card. Pick up where you left off, any
              time.
            </p>
            <div
              style={{
                display: "flex",
                gap: "14px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => navigate("/register")}
                style={{
                  height: "54px",
                  padding: "0 32px",
                  borderRadius: "100px",
                  background:
                    "linear-gradient(180deg, var(--primary-bright), var(--primary))",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 600,
                  border: "none",
                  boxShadow: "0 12px 24px rgba(29,83,48,0.4)",
                  cursor: "pointer",
                }}
              >
                Begin your path
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="btn-secondary"
                style={{ cursor: "pointer" }}
              >
                Log in
              </button>
            </div>
            <p
              style={{
                marginTop: "24px",
                fontSize: "12px",
                color: "var(--faint)",
              }}
            >
              Garzoni is a financial education platform, not a financial
              adviser.
            </p>
          </div>
        </section>

        {/* Spacer before footer */}
        <div style={{ height: "40px" }} />
      </div>

      {/* Preload the demo so the modal opens instantly when clicked */}
      <video
        data-testid="welcome-demo-preload-video"
        src={demoVideoUrl}
        preload="auto"
        muted
        playsInline
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <track kind="captions" srcLang="en" label="No captions available" />
      </video>

      {/* Demo video modal */}
      <Modal
        isOpen={isDemoOpen}
        title="See Garzoni in action"
        onClose={() => setIsDemoOpen(false)}
      >
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <video
            src={demoVideoUrl}
            poster={demoPosterUrl}
            controls
            autoPlay
            playsInline
            preload="auto"
            className="w-full"
            style={{ maxHeight: "70vh" }}
            aria-label="Garzoni product demo"
          >
            <track kind="captions" srcLang="en" label="No captions available" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="mt-4 flex flex-col items-center text-center">
          <button
            type="button"
            className="mt-2 rounded-full bg-[#E6C87A] px-6 py-2.5 text-sm font-semibold text-[#0B0F14] transition-colors duration-200 hover:bg-[#d4b669]"
            onClick={() => {
              setIsDemoOpen(false);
              navigate("/register");
            }}
          >
            Start learning free
          </button>
        </div>
      </Modal>

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
