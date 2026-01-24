import React from "react";
import { useTranslation } from "react-i18next";
import { setLanguage, supportedLanguages } from "../../i18n";

const LABELS: Record<string, string> = {
  en: "EN",
  es: "ES",
};

const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const current = i18n.language || "en";

  return (
    <select
      aria-label="Select language"
      value={current}
      onChange={(event) => setLanguage(event.target.value)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/35 text-[color:var(--muted-text,#6b7280)] shadow-sm transition hover:border-[color:var(--primary,#1d5330)]/45 hover:text-[color:var(--text-color,#111827)] hover:bg-[color:var(--primary,#1d5330)]/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/45 touch-manipulation sm:h-10 sm:w-10"
      style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      {supportedLanguages.map((lang) => (
        <option key={lang} value={lang}>
          {LABELS[lang] || lang.toUpperCase()}
        </option>
      ))}
    </select>
  );
};

export default LanguageSelector;
