import React, { useEffect, useRef } from "react";
import { useTheme } from "contexts/ThemeContext";
import { recordToolEvent } from "services/toolsAnalytics";

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:economic-map";
const WIDGET_SCRIPT_SRC =
  "https://widgets.tradingview-widget.com/w/en/tv-economic-map.js";

const EconomicMap = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: "Viewed economic map" })
    );
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.querySelector(`script[src="${WIDGET_SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = WIDGET_SCRIPT_SRC;
      document.head.appendChild(script);
    }

    const timer = window.setTimeout(() => {
      const key = "garzoni:tools:completed:economic-map";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "true");
      if (typeof window.gtag === "function") {
        window.gtag("event", "tool_completed", {
          tool_id: "economic-map",
          detail: "widget_loaded",
        });
      }
      recordToolEvent("tool_complete", "economic-map", {
        detail: "widget_loaded",
      });
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <section className="space-y-3 min-w-0 w-full">
      <div
        ref={containerRef}
        className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 p-2 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden w-full max-w-full"
        style={{ height: "75vh", minHeight: "min(320px, 50vh)" }}
      >
        {/* theme attribute updates when user toggles dark/light; widget follows app theme. */}
        <tv-economic-map
          theme={darkMode ? "dark" : "light"}
          style={{ width: "100%", height: "100%", minHeight: 0 }}
        />
      </div>
      <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
        Educational only - use as context, not a trading signal.
      </p>
    </section>
  );
};

export default EconomicMap;
