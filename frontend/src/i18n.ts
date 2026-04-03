import { initMonevoI18n, i18n, normalizeLanguage } from "@monevo/core/i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "constants/i18n";

const getInitialLanguage = () => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch (_) {
    // Ignore storage access issues
  }
  const browserLanguage =
    (typeof navigator !== "undefined" &&
      (navigator.languages?.[0] || navigator.language)) ||
    DEFAULT_LANGUAGE;
  return normalizeLanguage(browserLanguage);
};

initMonevoI18n({
  getInitialLanguage,
  persistLanguage: (language) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (_) {
      // Ignore storage access issues
    }
  },
  onLanguageChangedUI: (language) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  },
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
}

export default i18n;
