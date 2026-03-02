import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "constants/i18n";
import en from "./locales/en";
import ro from "./locales/ro";

const normalizeLanguage = (value?: string | null) => {
  if (!value) return DEFAULT_LANGUAGE;
  const lower = value.toLowerCase();
  if (lower.startsWith("ro")) return "ro";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
};

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

const supportedLanguageCodes = SUPPORTED_LANGUAGES.filter(
  (lang) => !("comingSoon" in lang && lang.comingSoon)
).map((lang) => lang.code);

i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    ro: { common: ro },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: supportedLanguageCodes,
  defaultNS: "common",
  ns: ["common"],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
}

const persistLanguage = (language: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (_) {
    // Ignore storage access issues
  }
};

i18n.on("languageChanged", (language) => {
  persistLanguage(language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
});

export default i18n;
