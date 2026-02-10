import React, { useEffect, useRef, memo } from "react";
import { useTheme } from "contexts/ThemeContext";
import { recordToolEvent } from "services/toolsAnalytics";
import { reportWidgetLoadError } from "../../sentry";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:news-context";
const WIDGET_HEIGHT = "82vh";

function TradingViewNewsWidget() {
  const container = useRef<HTMLDivElement | null>(null);
  const injected = useRef(false);
  const { darkMode } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: "Read TradingView news" })
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
      "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      feedMode: "all_symbols",
      isTransparent: false,
      displayMode: "regular",
      width: "100%",
      height: "100%",
      colorTheme: darkMode ? "dark" : "light",
      locale: "en" });

    script.onload = () => {
      const key = "monevo:tools:completed:news-context";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "true");
      if (typeof window.gtag === "function") {
        window.gtag("event", "tool_completed", {
          tool_id: "news-context",
          detail: "tradingview_news_loaded" });
      }
      recordToolEvent("tool_complete", "news-context", {
        detail: "tradingview_news_loaded" });
    };
    script.onerror = () => {
      reportWidgetLoadError(new Error("News (TradingView) widget script failed to load"), "news-context", { tool_id: "news-context" });
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
        style={{ height: WIDGET_HEIGHT, minHeight: "min(460px, 60vh)", width: "100%", colorScheme: darkMode ? "dark" : "light" }}
      >
        <div className="tradingview-widget-container__widget" style={{ width: "100%" }} />
        <div className="tradingview-widget-copyright text-center text-xs">
          <a
            href="https://www.tradingview.com/"
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="font-semibold text-[color:var(--primary,#2563eb)] hover:opacity-80"
          >
            Top stories by TradingView
          </a>
        </div>
      </div>
      <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
        Educational only - use as context, not a trading signal.
      </p>
    </section>
  );
}

export default memo(TradingViewNewsWidget);
