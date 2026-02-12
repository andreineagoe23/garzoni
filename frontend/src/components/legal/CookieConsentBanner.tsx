import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCookieConsent } from "contexts/CookieConsentContext";
import { GlassCard } from "components/ui";

export default function CookieConsentBanner() {
  const { t } = useTranslation();
  const {
    hasAnswered,
    consent,
    acceptAll,
    rejectNonEssential,
    setPreferences,
    setSettingsOpen,
    settingsOpen,
  } = useCookieConsent();

  const [analytics, setAnalytics] = useState(consent.analytics);
  const [marketing, setMarketing] = useState(consent.marketing);

  const openSettings = () => {
    setAnalytics(consent.analytics);
    setMarketing(consent.marketing);
    setSettingsOpen(true);
  };

  const handleSavePreferences = () => {
    setPreferences({ analytics, marketing });
    setSettingsOpen(false);
  };

  // Only show banner on production-like host if you want; here we show everywhere when not answered
  if (hasAnswered && !settingsOpen) return null;

  // Settings modal (first layer when reopened from footer)
  if (settingsOpen) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
      >
        <GlassCard padding="xl" className="w-full max-w-md space-y-6">
          <h2
            id="cookie-settings-title"
            className="text-xl font-semibold text-[color:var(--accent,#111827)]"
          >
            {t("cookieConsent.settingsTitle")}
          </h2>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("cookieConsent.settingsIntro")}
          </p>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {t("cookieConsent.necessaryNote")}
          </p>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#2563eb)] focus:ring-[color:var(--primary,#2563eb)]"
              />
              <span className="text-sm text-[color:var(--text-color,#111827)]">
                {t("cookieConsent.analyticsLabel")}
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#2563eb)] focus:ring-[color:var(--primary,#2563eb)]"
              />
              <span className="text-sm text-[color:var(--text-color,#111827)]">
                {t("cookieConsent.marketingLabel")}
              </span>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSavePreferences}
              className="rounded-lg bg-[color:var(--primary,#2563eb)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#2563eb)]/50"
            >
              {t("cookieConsent.save")}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-transparent px-4 py-2 text-sm font-medium text-[color:var(--text-color,#111827)] hover:bg-[color:var(--card-bg,#f3f4f6)] focus:outline-none focus:ring-2 focus:ring-[color:var(--border-color,#d1d5db)]"
            >
              {t("cookieConsent.cancel")}
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // First-layer banner: Accept and Reject with equal prominence (GDPR)
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm"
      role="region"
      aria-label={t("cookieConsent.bannerAria")}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[color:var(--text-color,#111827)]">
          {t("cookieConsent.message")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-lg bg-[color:var(--primary,#2563eb)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#2563eb)]/50"
          >
            {t("cookieConsent.acceptAll")}
          </button>
          <button
            type="button"
            onClick={rejectNonEssential}
            className="rounded-lg border-2 border-[color:var(--border-color,#374151)] bg-transparent px-4 py-2 text-sm font-medium text-[color:var(--text-color,#111827)] hover:bg-[color:var(--card-bg,#f3f4f6)] focus:outline-none focus:ring-2 focus:ring-[color:var(--muted-text,#6b7280)]/30"
          >
            {t("cookieConsent.rejectNonEssential")}
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="text-sm font-medium text-[color:var(--muted-text,#6b7280)] underline hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#2563eb)]/30 focus:ring-offset-2"
          >
            {t("cookieConsent.cookieSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}
