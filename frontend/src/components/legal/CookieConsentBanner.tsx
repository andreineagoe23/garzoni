import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCookieConsent } from "contexts/CookieConsentContext";
import { GlassButton, GlassCard } from "components/ui";

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
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
      >
        <GlassCard
          padding="xl"
          className="w-full max-w-md max-h-[min(90vh,calc(100vh-2rem))] overflow-y-auto"
        >
          <div className="space-y-4 sm:space-y-6">
            <h2
              id="cookie-settings-title"
              className="text-lg font-semibold text-[color:var(--accent,#111827)] sm:text-xl"
            >
              {t("cookieConsent.settingsTitle")}
            </h2>
            <p className="text-sm text-content-muted">
              {t("cookieConsent.settingsIntro")}
            </p>
            <p className="text-xs text-content-muted">
              {t("cookieConsent.necessaryNote")}
            </p>
            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#2563eb)] focus:ring-[color:var(--primary,#2563eb)]"
                />
                <span className="min-w-0 text-sm text-content-primary">
                  {t("cookieConsent.analyticsLabel")}
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#2563eb)] focus:ring-[color:var(--primary,#2563eb)]"
                />
                <span className="min-w-0 text-sm text-content-primary">
                  {t("cookieConsent.marketingLabel")}
                </span>
              </label>
            </div>
            <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3">
              <GlassButton
                variant="active"
                size="md"
                onClick={handleSavePreferences}
              >
                {t("cookieConsent.save")}
              </GlassButton>
              <GlassButton
                variant="ghost"
                size="md"
                onClick={() => setSettingsOpen(false)}
              >
                {t("cookieConsent.cancel")}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // First-layer banner: Accept and Reject with equal prominence (GDPR)
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:p-4 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label={t("cookieConsent.bannerAria")}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 flex-1 text-sm leading-snug text-content-primary">
          {t("cookieConsent.message")}
        </p>
        <div className="flex min-h-[44px] flex-row flex-wrap items-center gap-2 sm:gap-3">
          <GlassButton
            variant="active"
            size="sm"
            className="min-h-[44px] touch-manipulation sm:min-h-0"
            onClick={acceptAll}
          >
            {t("cookieConsent.acceptAll")}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            className="min-h-[44px] touch-manipulation sm:min-h-0"
            onClick={rejectNonEssential}
          >
            {t("cookieConsent.rejectNonEssential")}
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            className="min-h-[44px] touch-manipulation sm:min-h-0"
            onClick={openSettings}
          >
            {t("cookieConsent.cookieSettings")}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
