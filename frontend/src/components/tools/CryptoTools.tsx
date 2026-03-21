import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:crypto";
const WIDGET_LOAD_TIMEOUT_MS = 15000;

// Note: TradingView embed may log a moment.defineLocale deprecation in the console; that comes from their script and cannot be fixed here.

const CryptoTools = () => {
  const container = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const currentContainer = container.current;
    if (!currentContainer) return undefined;
    currentContainer.innerHTML = "";
    setLoadError(false);
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => setLoadError(true);
    const locale = i18n.language?.toLowerCase().startsWith("ro")
      ? "ro"
      : i18n.language?.toLowerCase().startsWith("es")
        ? "es"
        : "en";
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "500",
      symbol: "BITSTAMP:BTCUSD",
      interval: "D",
      timezone: "Europe/London",
      theme: darkMode ? "dark" : "light",
      style: "1",
      locale,
      withdateranges: true,
      allow_symbol_change: true,
      watchlist: [
        "BITSTAMP:BTCUSD",
        "COINBASE:ETHUSD",
        "COINBASE:SOLUSD",
        "BINANCE:XRPUSD",
        "BINANCE:ADAUSD",
      ],
      details: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || !currentContainer) return;
      currentContainer.appendChild(script);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          ACTIVITY_STORAGE_KEY,
          JSON.stringify({ label: "Watched crypto markets" })
        );
      }
    }, 100);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      const el = currentContainer?.querySelector(
        ".tradingview-widget-container__widget"
      );
      if (el && !el.hasChildNodes()) setLoadError(true);
    }, WIDGET_LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.clearTimeout(timeoutId);
      if (currentContainer && script.parentNode) {
        currentContainer.removeChild(script);
      }
      if (currentContainer) {
        currentContainer.innerHTML = "";
      }
    };
  }, [darkMode]);

  return (
    <section className="space-y-4 min-w-0 w-full">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)] sm:text-xl">
          {t("tools.crypto.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("tools.crypto.subtitle")}
        </p>
      </header>

      <div
        className="rounded-2xl sm:rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg shadow-lg shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] overflow-hidden w-full max-w-full"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {loadError && (
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-6 text-center text-sm text-[color:var(--error,#dc2626)]">
            <p className="font-semibold">
              {t("tools.crypto.errors.loadFailed")}
            </p>
            <p className="mt-2 text-[color:var(--muted-text,#6b7280)]">
              {t("tools.crypto.errors.loadFailedHelp")}
            </p>
            <a
              href="https://www.tradingview.com/"
              rel="noopener noreferrer"
              target="_blank"
              className="mt-3 inline-block rounded-lg border border-[color:var(--primary,#1d5330)] bg-[color:var(--primary,#1d5330)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--primary,#1d5330)] hover:opacity-90"
            >
              {t("tools.crypto.errors.openNewTab")}
            </a>
          </div>
        )}
        <div
          className={`tradingview-widget-container ${loadError ? "hidden" : ""}`}
          ref={container}
          style={{
            width: "100%",
            border: 0,
            overflow: "hidden",
            height: "clamp(340px, 55vh, 500px)",
            colorScheme: darkMode ? "dark" : "light",
          }}
        >
          <div
            className="tradingview-widget-container__widget"
            style={{ width: "100%", height: "100%" }}
          />
          <div className="tradingview-widget-copyright text-center text-xs">
            <a
              href="https://www.tradingview.com/"
              rel="noopener noreferrer"
              target="_blank"
              className="font-semibold text-[color:var(--accent,#ffd700)] hover:text-[color:var(--accent,#ffd700)]/80"
            >
              {t("tools.crypto.tradingViewLabel")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CryptoTools;
