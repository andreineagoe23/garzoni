import React, { useEffect, useRef } from "react";
import { useTheme } from "contexts/ThemeContext";

const CryptoTools = () => {
  const container = useRef(null);
  const { darkMode } = useTheme();

  useEffect(() => {
    const currentContainer = container.current;
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "500",
      symbol: "BITSTAMP:BTCUSD",
      interval: "D",
      timezone: "Europe/London",
      theme: darkMode ? "dark" : "light",
      style: "1",
      locale: "en",
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

    const timer = setTimeout(() => {
      if (currentContainer) {
        currentContainer.appendChild(script);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (currentContainer && script.parentNode) {
        currentContainer.removeChild(script);
      }
    };
  }, [darkMode]);

  return (
    <section className="space-y-4">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Crypto Chart
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Interactive chart powered by TradingView for the most watched crypto
          pairs.
        </p>
      </header>

      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg shadow-lg shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="tradingview-widget-container" ref={container} style={{ width: '100%', border: 0, overflow: 'hidden', height: '500px' }}>
          <div className="tradingview-widget-container__widget" style={{ width: '100%', height: '100%' }} />
          <div className="tradingview-widget-copyright text-center text-xs">
            <a
              href="https://www.tradingview.com/"
              rel="noopener noreferrer"
              target="_blank"
              className="font-semibold text-[color:var(--accent,#2563eb)] hover:text-[color:var(--accent,#2563eb)]/80"
            >
              Track all markets on TradingView
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CryptoTools;
