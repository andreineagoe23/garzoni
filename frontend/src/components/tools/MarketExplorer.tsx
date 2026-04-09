import React, { useEffect, useRef, memo } from "react";
import { useTheme } from "contexts/ThemeContext";
import { recordToolEvent } from "services/toolsAnalytics";

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:market-explorer";

const MARKET_EXPLORER_HEIGHT = "95vh";

function TradingViewMarketExplorer() {
  const container = useRef<HTMLDivElement | null>(null);
  const injected = useRef(false);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: "Explored markets" })
    );
  }, []);

  // Inject once per component instance. Guard prevents double inject when React Strict Mode
  // runs the effect twice; re-running on darkMode would clear the script and cause "Script error."
  useEffect(() => {
    const currentContainer = container.current;
    if (!currentContainer || injected.current) return;
    injected.current = true;

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: "D",
      locale: "en",
      save_image: true,
      style: "1",
      symbol: "NASDAQ:AAPL",
      theme: darkMode ? "dark" : "light",
      timezone: "Etc/UTC",
      backgroundColor: darkMode ? "#0F0F0F" : "#FFFFFF",
      gridColor: "rgba(242, 242, 242, 0.06)",
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize: true,
    });

    script.onload = () => {
      const key = "garzoni:tools:completed:market-explorer";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "true");
      if (typeof window.gtag === "function") {
        window.gtag("event", "tool_completed", {
          tool_id: "market-explorer",
          detail: "advanced_chart_loaded",
        });
      }
      recordToolEvent("tool_complete", "market-explorer", {
        detail: "advanced_chart_loaded",
      });
    };

    currentContainer.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inject once to avoid Script error when script loads after container cleared
  }, []);

  return (
    <section className="space-y-3 min-w-0 w-full">
      {/* Theme (dark/light) is set at first load from app theme; script embed cannot update on toggle. */}
      <div
        className="tradingview-widget-container rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden w-full max-w-full"
        ref={container}
        style={{
          height: MARKET_EXPLORER_HEIGHT,
          minHeight: "min(600px, 70vh)",
          width: "100%",
          colorScheme: darkMode ? "dark" : "light",
        }}
      >
        <div
          className="tradingview-widget-container__widget"
          style={{ width: "100%" }}
        />
        <div className="tradingview-widget-copyright text-center text-xs">
          <a
            href="https://www.tradingview.com/symbols/NASDAQ-AAPL/"
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="font-semibold text-[color:var(--primary,#1d5330)] hover:opacity-80"
          >
            AAPL stock chart
          </a>
          <span className="text-content-muted"> by TradingView</span>
        </div>
      </div>
      <p className="text-center text-xs text-content-muted">
        Educational only - use as context, not a trading signal.
      </p>
    </section>
  );
}

export default memo(TradingViewMarketExplorer);
