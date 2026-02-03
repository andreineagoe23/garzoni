import React, { useEffect } from "react";

// Investing.com pip calculator — iframe embed. No third-party script, no gtag/POST 404.
const INVESTING_PIP_CALC_BASE = "https://ssltools.investing.com/pip-calculator";
const FOREX_CALC_OPEN_URL = "https://www.investing.com/tools/forex-pip-calculator";

const ForexTools = () => {

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "monevo:tools:activity:forex",
        JSON.stringify({ label: "Viewed forex calculator" })
      );
    }
  }, []);

  // force_lang 51 = English (configurable per Investing.com docs)
  const iframeSrc = `${INVESTING_PIP_CALC_BASE}/index.php?force_lang=51`;

  return (
    <section className="space-y-4">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          Forex Pip & Position Calculator
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Calculate pip values and position sizes for your forex pairs
        </p>
      </header>

      <div className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-6 shadow-xl shadow-black/5">
        <iframe
          title="Forex Pip Calculator"
          src={iframeSrc}
          className="h-[520px] w-full overflow-hidden rounded-2xl border-0 bg-[color:var(--bg-color,#f8fafc)]"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
        <p className="mt-2 text-center text-xs text-[color:var(--muted-text,#6b7280)]">
          Calculator by{" "}
          <a
            href={FOREX_CALC_OPEN_URL}
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-[color:var(--primary,#2563eb)] hover:opacity-80"
          >
            Investing.com
          </a>
          . If it doesn’t load above,{" "}
          <a
            href={FOREX_CALC_OPEN_URL}
            rel="noopener noreferrer"
            target="_blank"
            className="font-semibold text-[color:var(--primary,#2563eb)] underline hover:opacity-80"
          >
            open it in a new tab
          </a>
          .
        </p>
      </div>
    </section>
  );
};

export default ForexTools;
