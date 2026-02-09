import React, { useEffect } from "react";
import { useTheme } from "contexts/ThemeContext";
import { Trans, useTranslation } from "react-i18next";

const ACTIVITY_STORAGE_KEY = "monevo:tools:activity:calendar";

// Investing.com economic calendar - embeddable iframe (allows framing). No Cashback Forex, no gtag.
const INVESTING_CALENDAR_BASE = "https://sslecal2.investing.com";
const CALENDAR_OPEN_URL = "https://www.investing.com/economic-calendar/";

const NewsCalendars = () => {
  const { darkMode } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify({ label: t("tools.calendarEmbed.activityLabel") })
      );
    }
  }, [t]);

  const iframeSrc = `${INVESTING_CALENDAR_BASE}?theme=${darkMode ? "dark" : "light"}&calendarType=week&size=8&width=100%25&height=600`;

  return (
    <section className="space-y-4">
      <header className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
          {t("tools.calendarEmbed.title")}
        </h3>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("tools.calendarEmbed.subtitle")}
        </p>
      </header>

      <div
        className="rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 backdrop-blur-lg px-4 py-4 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))]"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="relative">
          <iframe
            title={t("tools.calendarEmbed.iframeTitle")}
            src={iframeSrc}
            className="h-[600px] w-full overflow-hidden rounded-2xl border-0 bg-[color:var(--bg-color,#f8fafc)]"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
          {/* Fallback CTA: if calendar is blocked (e.g. ad blocker), user can open in new tab */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-center">
            <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
              <Trans
                i18nKey="tools.calendarEmbed.fallback"
                components={{
                  provider: (
                    <a
                      href={CALENDAR_OPEN_URL}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="font-semibold text-[color:var(--primary,#2563eb)] hover:opacity-80"
                    />
                  ),
                  open: (
                    <a
                      href={CALENDAR_OPEN_URL}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="font-semibold text-[color:var(--primary,#2563eb)] underline hover:opacity-80"
                    />
                  ) }}
              />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsCalendars;
