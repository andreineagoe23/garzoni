import React, { useMemo, useState } from "react";
import { useAuth } from "contexts/AuthContext";
import { recordToolEvent } from "services/toolsAnalytics";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:next-steps";

const TOOL_ACTIVITY_KEYS = [
  "monevo:tools:activity:calendar",
  "monevo:tools:activity:news-context",
  "monevo:tools:activity:portfolio",
  "monevo:tools:activity:reality-check",
  "monevo:tools:activity:market-explorer",
];

const NextStepsEngine = () => {
  const [useDemo, setUseDemo] = useState(false);
  const { financialProfile } = useAuth();

  const recommendations = useMemo(() => {
    const activity = TOOL_ACTIVITY_KEYS.map((key) =>
      typeof window !== "undefined" ? sessionStorage.getItem(key) : null
    ).filter(Boolean);

    if (useDemo || activity.length === 0) {
      return [
        {
          id: "demo-learn-inflation",
          label: "Learn: Inflation basics",
          detail: "Start with the lesson to decode CPI and prices.",
          because: "Demo: a good first step for anyone.",
          href: "/all-topics?topic=inflation",
        },
        {
          id: "demo-try-reality",
          label: "Try: Savings & Goals Reality Check",
          detail: "See if your next goal is realistic in 2 minutes.",
          because: "Demo: helps you test a goal against your budget.",
          href: "/tools/reality-check",
        },
        {
          id: "demo-explore-markets",
          label: "Explore: Market Explorer",
          detail: "Scan major markets without the trading noise.",
          because: "Demo: builds context before decisions.",
          href: "/tools/market-explorer",
        },
      ];
    }

    const portfolioRisk =
      typeof window !== "undefined"
        ? sessionStorage.getItem("monevo:tools:signal:portfolio_risk")
        : null;
    const newsBrowsing =
      typeof window !== "undefined"
        ? sessionStorage.getItem("monevo:tools:activity:news-context")
        : null;

    const candidates: Array<{
      id: string;
      label: string;
      detail: string;
      because?: string;
      href: string;
      score: number;
    }> = [];

    if (portfolioRisk === "high") {
      candidates.push({
        id: "risk-high",
        label: "Learn: Diversification basics",
        detail: "Reduce concentration risk before adding more positions.",
        because: "Because your portfolio has high concentration in one area.",
        href: "/all-topics?topic=diversification",
        score: 3,
      });
    } else if (portfolioRisk === "moderate") {
      candidates.push({
        id: "risk-moderate",
        label: "Review portfolio concentration",
        detail: "Check if any single holding dominates your mix.",
        because: "Because your portfolio concentration is moderate; worth a quick check.",
        href: "/tools/portfolio",
        score: 2.5,
      });
    }

    if (financialProfile?.investing_experience === "new") {
      candidates.push({
        id: "fundamentals",
        label: "Learn: Investing fundamentals",
        detail: "Build a baseline before making changes.",
        because: "Because you’re new to investing; fundamentals help first.",
        href: "/all-topics?topic=investing",
        score: 2,
      });
    }

    if (financialProfile?.goal_types?.some((g) => ["save", "emergency"].includes(g))) {
      candidates.push({
        id: "goal-check",
        label: "Reality-check your savings goal",
        detail: "Turn your goal into a realistic monthly range.",
        because: "Because your profile includes savings or emergency goals.",
        href: "/tools/reality-check",
        score: 2,
      });
    }

    if (newsBrowsing) {
      candidates.push({
        id: "calendar-bridge",
        label: "Connect news to macro events",
        detail: "See what upcoming events could move prices.",
        because: "Because you’ve been reading news; the calendar adds context.",
        href: "/tools/calendar",
        score: 1.5,
      });
    }

    if (candidates.length === 0) {
      candidates.push(
        {
          id: "next-calendar",
          label: "Check upcoming macro events",
          detail: "See what might influence rates and prices this week.",
          because: "A useful default when nothing else is suggested.",
          href: "/tools/calendar",
          score: 1,
        },
        {
          id: "next-portfolio",
          label: "Review portfolio concentration",
          detail: "Spot any overweight positions before you make changes.",
          because: "A useful default to keep portfolio risk in mind.",
          href: "/tools/portfolio",
          score: 1,
        },
        {
          id: "next-reality",
          label: "Reality-check your next goal",
          detail: "Confirm your target fits your cash flow.",
          because: "A useful default to align goals with budget.",
          href: "/tools/reality-check",
          score: 1,
        }
      );
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [useDemo, financialProfile]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: "Viewed next steps" })
    );
    const key = "monevo:tools:completed:next-steps";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    if (typeof window.gtag === "function") {
      window.gtag("event", "tool_completed", {
        tool_id: "next-steps",
        detail: "recommendations_viewed",
      });
    }
    recordToolEvent("tool_complete", "next-steps", {
      detail: "recommendations_viewed",
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    recordToolEvent("recommendation_shown", "next-steps", {
      ids: recommendations.map((item) => item.id),
    });
  }, [recommendations]);

  return (
    <section className="space-y-6 min-w-0 w-full">
      <div className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-5 sm:px-6 sm:py-6 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Decision recommender
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              1–3 focused next steps based on your recent activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUseDemo((prev) => !prev)}
              className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
            >
              {useDemo ? "Use live activity" : "Use demo recommendations"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
        {recommendations.map((item) => (
          <a
            key={item.id}
            href={item.href}
            onClick={() => {
              recordToolEvent("recommendation_click", "next-steps", {
                recommendation_id: item.id,
              });
              const isLesson = item.href.startsWith("/all-topics");
              if (isLesson) {
                recordToolEvent("tool_to_lesson_click", "next-steps", {
                  href: item.href,
                  recommendation_id: item.id,
                });
                if (typeof window.gtag === "function") {
                  window.gtag("event", "lesson_started_from_tool", {
                    tool_id: "next-steps",
                    link: item.href,
                  });
                }
              }
              if (typeof window.gtag === "function") {
                window.gtag("event", "recommendation_click", {
                  tool_id: "next-steps",
                  recommendation_id: item.id,
                });
              }
            }}
            className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md min-w-0 block"
          >
            <p className="text-sm font-semibold text-[color:var(--accent,#111827)]">
              {item.label}
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              {item.detail}
            </p>
            {item.because && (
              <p className="mt-1.5 text-xs italic text-[color:var(--muted-text,#6b7280)]">
                {item.because.toLowerCase().startsWith("because ")
                  ? item.because
                  : `Because ${item.because.charAt(0).toLowerCase() + item.because.slice(1)}`}
              </p>
            )}
            <span className="mt-3 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)]">
              Take action →
            </span>
          </a>
        ))}
      </div>
    </section>
  );
};

export default NextStepsEngine;
