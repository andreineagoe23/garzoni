import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "contexts/ThemeContext";
import { useAuth } from "contexts/AuthContext";
import { CALENDAR_EXPLAINERS } from "./lessonMapping";
import { recordToolEvent } from "services/toolsAnalytics";
import { captureMessage } from "../../sentry";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:calendar";

const WIDGET_LOAD_TIMEOUT_MS = 15000;

const EconomicCalendar = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastInjectedRef = useRef<{ dark: boolean; all: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const { darkMode } = useTheme();
  const { financialProfile } = useAuth();

  const relevanceTags = useMemo(() => {
    const tags = new Set<string>();
    const goals = financialProfile?.goal_types || [];
    if (goals.some((g) => ["save", "emergency", "savings"].includes(g))) {
      tags.add("saver");
    }
    if (goals.some((g) => ["invest", "wealth", "portfolio"].includes(g))) {
      tags.add("investor");
    }
    if (goals.some((g) => ["debt", "loan", "mortgage"].includes(g))) {
      tags.add("borrower");
    }
    return tags;
  }, [financialProfile?.goal_types]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: "Checked macro events" })
    );
  }, []);

  // Inject widget; re-inject when theme or filter changes so calendar matches app (dark/light) and importance filter.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sameConfig =
      lastInjectedRef.current?.dark === darkMode &&
      lastInjectedRef.current?.all === showAllEvents;
    if (sameConfig && container.hasChildNodes()) return;

    const isReinject = lastInjectedRef.current !== null;
    if (isReinject) {
      setLoaded(false);
      setLoadError(false);
      container.innerHTML = "";
    }
    lastInjectedRef.current = { dark: darkMode, all: showAllEvents };

    setLoadError(false);
    setLoaded(false);

    const calendarHeight =
      typeof window !== "undefined" && window.innerWidth < 640 ? 400 : window.innerWidth < 1024 ? 560 : 760;
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    const theme = darkMode ? "dark" : "light";
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: calendarHeight,
      locale: "en",
      colorTheme: theme,
      theme: theme,
      isTransparent: false,
      importanceFilter: showAllEvents ? "-1,0,1" : "1",
      currencyFilter: "USD,EUR,GBP,JPY,CAD,AUD",
    });
    script.onload = () => setLoaded(true);
    script.onerror = () => {
      captureMessage("Calendar widget failed to load (script error)", "warning", { tool_id: "calendar" });
      setLoadError(true);
    };

    const timeoutId = window.setTimeout(() => {
      setLoaded((prev) => {
        if (!prev) {
          captureMessage("Calendar widget load timeout", "warning", { tool_id: "calendar" });
          setLoadError(true);
        }
        return prev;
      });
    }, WIDGET_LOAD_TIMEOUT_MS);

    container.appendChild(script);

    return () => {
      window.clearTimeout(timeoutId);
      if (!isReinject) {
        // Do not clear container on unmount: TradingView script may still load and query parent.
      }
    };
  }, [darkMode, showAllEvents]);

  useEffect(() => {
    if (!loaded || typeof window === "undefined") return;
    const key = "monevo:tools:completed:calendar";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    if (typeof window.gtag === "function") {
      window.gtag("event", "tool_completed", {
        tool_id: "calendar",
        detail: "calendar_loaded",
      });
    }
    recordToolEvent("tool_complete", "calendar", { detail: "calendar_loaded" });
  }, [loaded]);

  return (
    <section className="space-y-6 min-w-0 w-full">
      <div className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-3 py-4 sm:px-4 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              Impact filter
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              High-impact events only by default.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllEvents((prev) => !prev)}
            className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
          >
            {showAllEvents ? "Hide low-impact events" : "Show all events"}
          </button>
        </div>
        {/* Theme (dark/light) is set at first load from app theme; script embed cannot update on toggle. */}
        {loadError && (
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-6 text-center text-sm text-[color:var(--error,#dc2626)]">
            <p className="font-semibold">Calendar failed to load.</p>
            <p className="mt-2 text-[color:var(--muted-text,#6b7280)]">
              Try disabling ad blockers or content blockers for this site, or open the calendar in a new tab.
            </p>
            <a
              href="https://www.tradingview.com/economic-calendar/"
              rel="noopener noreferrer"
              target="_blank"
              className="mt-3 inline-block rounded-lg border border-[color:var(--primary,#2563eb)] bg-[color:var(--primary,#2563eb)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--primary,#2563eb)] hover:opacity-90"
            >
              Open calendar in new tab
            </a>
          </div>
        )}
        {!loaded && !loadError && (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] px-4 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
            Loading the economic calendar…
          </div>
        )}
        <div
          ref={containerRef}
          className={`min-w-0 w-full ${loadError ? "hidden" : ""} ${darkMode ? "bg-[#131722]" : ""}`}
          style={!loadError ? { minHeight: "clamp(380px, 55vh, 760px)", colorScheme: darkMode ? "dark" : "light" } : undefined}
        />
        <p className="mt-2 text-center text-xs text-[color:var(--muted-text,#6b7280)]">
          Economic calendar by{" "}
          <a
            href="https://www.tradingview.com/economic-calendar/"
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-[color:var(--primary,#2563eb)] hover:opacity-80"
          >
            TradingView
          </a>
          . If it doesn’t load,{" "}
          <a
            href="https://www.tradingview.com/economic-calendar/"
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-[color:var(--primary,#2563eb)] underline hover:opacity-80"
          >
            open it in a new tab
          </a>
          .
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CALENDAR_EXPLAINERS.map((event) => {
          const isRelevant =
            relevanceTags.size > 0 &&
            event.tags?.some((tag) => relevanceTags.has(tag));
          return (
          <div
            key={event.label}
            className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/90 px-4 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                {event.label}
              </h4>
              <div className="flex items-center gap-2">
                {isRelevant && (
                  <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)]">
                    Relevant to you
                  </span>
                )}
                <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {event.difficulty}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                Why this matters:
              </span>{" "}
              {event.why}
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                Who should care:
              </span>{" "}
              {event.who}
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                What it affects:
              </span>{" "}
              {event.affects}
            </p>
            <a
              href={event.learnPath}
              onClick={() => {
                recordToolEvent("tool_to_lesson_click", "calendar", {
                  href: event.learnPath,
                  event_label: event.label,
                });
                if (typeof window.gtag === "function") {
                  window.gtag("event", "lesson_started_from_tool", {
                    tool_id: "calendar",
                    link: event.learnPath,
                  });
                }
              }}
              className="mt-3 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)] hover:opacity-80"
            >
              Learn more →
            </a>
          </div>
        );
        })}
      </div>
    </section>
  );
};

export default EconomicCalendar;
