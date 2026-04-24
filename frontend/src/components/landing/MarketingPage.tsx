import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Header from "components/layout/Header";
import { useTheme } from "contexts/ThemeContext";
import "./marketing.css";

const FAQ_ITEMS = [
  {
    q: "Is Garzoni financial advice?",
    a: "No. Garzoni is a financial education app. We explain concepts, run simulations, and help you practice decisions — but we don't recommend specific products, and we're not a registered financial advisor.",
  },
  {
    q: "How is my data stored?",
    a: "Your learning progress and preferences are stored encrypted on your device and synced to our EU-based servers. We never sell data. Read the Privacy Policy for the full detail.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Subscriptions are managed through your Apple ID — cancel in one tap from Settings. You keep Pro features until the end of your billing period.",
  },
  {
    q: "Do you connect to my bank?",
    a: "Not today. Garzoni is an education-first app; numbers you enter into simulators stay on-device. Bank-linked features are on our roadmap for an opt-in tier.",
  },
  {
    q: "What languages are supported?",
    a: "English at launch, with French, Spanish and Italian rolling out over the following quarters. Speaker-notes and captions are included throughout.",
  },
  {
    q: "Is there an Android version?",
    a: "An Android build is in internal testing. Join the waitlist above and we'll let you know when it's public.",
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

function MarketingPage() {
  const { darkMode } = useTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <>
      <Helmet>
        <title>Garzoni — Finance that actually sticks</title>
        <meta
          name="description"
          content="Garzoni is a personal finance education app. Build streaks, earn XP, and master your money with AI-powered tools."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <div className={`mkt${darkMode ? "" : " mkt-light"}`}>
        <Header />

        {/* HERO */}
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
              <div className="cta-row">
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-store"
                >
                  <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
                    <path
                      d="M18.5 19.1c-.5 1.2-1.1 2.3-1.9 3.3-1 1.3-2 2.3-3 2.3-1 0-1.7-.7-3-.7s-2 .7-3 .7c-1.1 0-2-1-3-2.3C3 20.9 2 18.5 2 15.8c0-3.1 1.9-4.8 3.8-4.8 1.1 0 2 .7 3.1.7 1 0 1.8-.8 3.1-.8.9 0 2.3.5 3.3 1.5-3 2-2.5 5.6.2 6.7zM14.6 6.3c-.9 1-2 1.7-3.3 1.6-.1-1.2.5-2.5 1.2-3.3.8-1 2.1-1.7 3.1-1.7.1 1.3-.4 2.5-1 3.4z"
                      fill="#e5e7eb"
                    />
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
                <Link to="/register" className="btn-secondary">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7 1l2 4 5 .7-3.5 3.5.8 5L7 11.8 2.7 14.2l.8-5L0 5.7 5 5z"
                      fill="#e6c87a"
                    />
                  </svg>
                  Join the waitlist
                </Link>
              </div>
              <div className="hero-meta">
                <div>
                  <strong>
                    4.9
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
                  <span>Beta users</span>
                </div>
                <div>
                  <strong>84%</strong>
                  <span>Keep a streak</span>
                </div>
              </div>
            </div>

            {/* Hero device */}
            <div className="hero-device">
              <div className="device">
                <div className="device-screen">
                  <div
                    className="eyebrow"
                    style={{ textAlign: "center", marginTop: "6px" }}
                  >
                    Daily practice
                  </div>
                  <div className="device-card">
                    <div className="streak-head">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div className="dot-gold" />
                        <span className="streak-label">Current streak</span>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontStyle: "italic",
                          fontSize: "12px",
                          color: "var(--gold-warm)",
                        }}
                      >
                        Day 3
                      </span>
                    </div>
                    <div className="streak-val">
                      120<small>XP</small>
                    </div>
                    <div className="streak-strip">
                      {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                        <div key={i} className="streak-day">
                          <div
                            className={`streak-cell${i === 0 || i === 1 ? " done" : i === 2 ? " today" : ""}`}
                          />
                          <span className="streak-day-label">{day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* LOGO RAIL */}
        <section className="rail">
          <div className="wrap rail-inner">
            <div className="rail-label">Featured in</div>
            <div className="rail-logos">
              {[
                "The Economist",
                "Bloomberg",
                "TechCrunch",
                "Fast Company",
                "Sifted",
              ].map((name) => (
                <span key={name} className="rail-logo">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="section" id="features">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">What's inside</div>
              <h2>
                A toolkit that turns <em className="em-gold">knowing</em> into{" "}
                <em className="em-gold">doing</em>.
              </h2>
              <p>
                Three layers working together — the daily habit, the guided
                lessons, and the AI-powered simulators that let you
                pressure-test real decisions.
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
                            i < 2
                              ? `1px solid rgba(42,115,71,${i === 0 ? "0.35" : "0.4"})`
                              : "none",
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

        {/* STORY */}
        <section className="section" style={{ paddingTop: "40px" }}>
          <div className="wrap">
            <div className="story">
              {/* Split 1 */}
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
                        <div className="onb-card">
                          <div className="onb-card-icon">
                            <svg width="14" height="14" viewBox="0 0 22 22">
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
                            </svg>
                          </div>
                          <h4>Build a budget</h4>
                          <span>Know where it goes</span>
                        </div>
                        <div className="onb-card">
                          <div className="onb-card-icon">
                            <svg width="14" height="14" viewBox="0 0 22 22">
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
                            </svg>
                          </div>
                          <h4>Pay down debt</h4>
                          <span>Shrink balances</span>
                        </div>
                        <div className="onb-card sel">
                          <div className="onb-card-icon">
                            <svg width="14" height="14" viewBox="0 0 22 22">
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
                            </svg>
                          </div>
                          <h4>Grow savings</h4>
                          <span>Build a cushion</span>
                        </div>
                        <div className="onb-card">
                          <div className="onb-card-icon">
                            <svg width="14" height="14" viewBox="0 0 22 22">
                              <path
                                d="M3 18 L8 12 L12 15 L16 8 L20 4"
                                stroke="#2a7347"
                                strokeWidth="1.6"
                                fill="none"
                                strokeLinecap="round"
                              />
                              <circle cx="20" cy="4" r="1.8" fill="#2a7347" />
                            </svg>
                          </div>
                          <h4>Start investing</h4>
                          <span>Money to work</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Split 2 */}
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

              {/* Split 3 */}
              <div className="split">
                <div className="split-copy">
                  <div className="eyebrow">Choose your pace</div>
                  <h3>
                    Start free. <em className="em-gold">Upgrade</em> when it
                    fits.
                  </h3>
                  <p>
                    Starter is free forever — streaks, XP and the full lesson
                    library. Plus unlocks personalisation and unlimited
                    calculators. Pro adds advanced simulations, priority AI
                    guidance and early access to new tools.
                  </p>
                  <Link
                    to="/subscriptions"
                    className="btn-secondary"
                    style={{ marginTop: "6px" }}
                  >
                    See pricing
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <path
                        d="M3 7h8M8 4l3 3-3 3"
                        stroke="#e5e7eb"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Link>
                </div>
                <div className="split-device">
                  <div className="mini-device">
                    <div
                      className="mini-screen"
                      style={{
                        padding: "54px 14px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {[
                        {
                          name: "Starter",
                          sub: "Free forever",
                          dotColor: "var(--ghost)",
                          gold: false,
                        },
                        {
                          name: "Plus",
                          sub: "Personalised path",
                          dotColor: "var(--primary-bright)",
                          gold: false,
                        },
                        {
                          name: "Pro",
                          sub: "Full toolkit",
                          dotColor: "var(--gold)",
                          gold: true,
                        },
                      ].map(({ name, sub, dotColor, gold }) => (
                        <div
                          key={name}
                          style={{
                            background: gold
                              ? "linear-gradient(135deg, rgba(230,200,122,0.08), var(--surface) 60%)"
                              : "var(--surface)",
                            border: `1px solid ${gold ? "var(--gold-warm)" : "var(--border)"}`,
                            borderRadius: "12px",
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            boxShadow: gold
                              ? "0 0 0 1px rgba(255,215,0,0.08)"
                              : "none",
                            transform: gold ? "scale(1.03)" : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "4px",
                                background: dotColor,
                                boxShadow: gold
                                  ? "0 0 8px var(--gold)"
                                  : "none",
                              }}
                            />
                            <div>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: gold ? "var(--gold-warm)" : "inherit",
                                }}
                              >
                                {name}
                              </span>
                              {gold && (
                                <div
                                  style={{
                                    fontSize: "8px",
                                    color: "var(--gold-warm)",
                                    letterSpacing: "1px",
                                    textTransform: "uppercase",
                                    opacity: 0.75,
                                    marginTop: "1px",
                                  }}
                                >
                                  Recommended
                                </div>
                              )}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--muted)",
                              fontFamily: "var(--font-display)",
                              fontStyle: "italic",
                            }}
                          >
                            {sub}
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          marginTop: "14px",
                          paddingLeft: "4px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        {[
                          "Advanced simulations",
                          "Priority AI guidance",
                          "Early access to new tools",
                        ].map((perk) => (
                          <div
                            key={perk}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "10px",
                              color: "var(--muted)",
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 14 14">
                              <circle
                                cx="7"
                                cy="7"
                                r="7"
                                fill="rgba(29,83,48,0.2)"
                              />
                              <path
                                d="M4 7.2l2 2 4-4.5"
                                stroke="#2a7347"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                            {perk}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section" id="pricing">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Pricing</div>
              <h2>
                Honest, <em className="em-gold">cancel-anytime</em> pricing.
              </h2>
              <p>
                Start free and stay free — or upgrade when you're ready for
                deeper tools. Annual plans save 20%.
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
                  <span className="val">$0</span>
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
                <Link
                  to="/register"
                  className="price-cta default"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Get Starter
                </Link>
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
                  <span className="val">$6.40</span>
                  <span className="unit">/ month</span>
                </div>
                <div className="price-sub">Billed $76.80 annually</div>
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
                <Link
                  to="/subscriptions"
                  className="price-cta green"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Start Plus
                </Link>
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
                  <span className="val">$11.99</span>
                  <span className="unit">/ month</span>
                </div>
                <div className="price-sub">
                  Billed $143.90 annually · save 20%
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
                <Link
                  to="/subscriptions"
                  className="price-cta gold"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Start Pro
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* QUOTE */}
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
              <strong>Léa M.</strong> — Beta user, Paris
            </div>
          </div>
        </section>

        {/* FAQ */}
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
                  onClick={() => toggleFaq(i)}
                  onKeyDown={(e) =>
                    e.key === "Enter" || e.key === " "
                      ? toggleFaq(i)
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

        {/* REVIEWER BLOCK */}
        <section id="review">
          <div className="wrap">
            <div className="reviewer">
              <div className="reviewer-head">
                <span className="reviewer-tag">For App Review</span>
                <h3>Reviewer information</h3>
              </div>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  maxWidth: "640px",
                  margin: "0 0 28px",
                }}
              >
                This section exists for the App Store review team. It provides a
                demo account, testing notes, and direct contact details so
                reviewing Garzoni is fast and frictionless.
              </p>
              <dl className="reviewer-grid">
                <div className="rv-block">
                  <dt>Demo Email</dt>
                  <dd>reviewer@garzoni.app</dd>
                </div>
                <div className="rv-block">
                  <dt>Demo Password</dt>
                  <dd>Review2026!</dd>
                </div>
                <div className="rv-block copy">
                  <dt>Support Contact</dt>
                  <dd>andreineagoe@garzoni.app</dd>
                </div>
                <div className="rv-block copy">
                  <dt>Response Time</dt>
                  <dd>Within 24 hours, Monday–Friday</dd>
                </div>
                <div className="rv-block">
                  <dt>TestFlight Build</dt>
                  <dd>testflight.apple.com/join/XXXXXXXX</dd>
                </div>
                <div className="rv-block copy">
                  <dt>In-App Purchase Notes</dt>
                  <dd>
                    Use the demo account above. Sandbox purchases are
                    pre-configured for Plus & Pro tiers (monthly and annual).
                  </dd>
                </div>
              </dl>
              <div className="reviewer-note" id="privacy">
                <strong style={{ color: "var(--text)", fontWeight: 500 }}>
                  Compliance notes:
                </strong>{" "}
                Garzoni is an educational product and does not provide
                personalised financial advice. We do not connect to banks,
                execute trades, or custody funds. Content is age-appropriate for
                a 12+ rating. Full Privacy Policy and Terms available at{" "}
                <Link
                  to="/privacy-policy"
                  style={{
                    color: "var(--primary-bright)",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  garzoni.app/privacy
                </Link>{" "}
                and{" "}
                <Link
                  to="/terms-of-service"
                  style={{
                    color: "var(--primary-bright)",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  garzoni.app/terms
                </Link>
                .
              </div>
            </div>
          </div>
        </section>

        {/* Spacer before app footer */}
        <div style={{ height: "80px" }} />
      </div>
    </>
  );
}

export default MarketingPage;
