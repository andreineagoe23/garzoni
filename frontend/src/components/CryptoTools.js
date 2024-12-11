import React, { useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const CryptoTools = () => {
  const container = useRef();

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
      theme: "light",
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
  }, []);

  return (
    <div className="container mt-4">
      <div className="card shadow">
        <div className="card-body">
          <h3 className="card-title text-center mb-4">Crypto Chart</h3>
          <div className="tradingview-widget-container" ref={container}>
            <div className="tradingview-widget-container__widget"></div>
            <div className="tradingview-widget-copyright text-center">
              <a
                href="https://www.tradingview.com/"
                rel="noopener noreferrer"
                target="_blank"
                className="text-decoration-none"
              >
                <span className="text-primary">
                  Track all markets on TradingView
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoTools;
