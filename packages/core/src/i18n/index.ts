import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from "constants/i18n";
import en from "../locales/en";
import ro from "../locales/ro";

const normalizeLanguage = (value?: string | null) => {
  if (!value) return DEFAULT_LANGUAGE;
  const lower = value.toLowerCase();
  if (lower.startsWith("ro")) return "ro";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
};

const supportedLanguageCodes = SUPPORTED_LANGUAGES.filter(
  (lang) => !("comingSoon" in lang && lang.comingSoon)
).map((lang) => lang.code);

export type MonevoI18nPlatformHooks = {
  /** Resolve starting language (e.g. localStorage + navigator on web, AsyncStorage on native). */
  getInitialLanguage?: () => string;
  /** Persist when the user or app changes language. */
  persistLanguage?: (language: string) => void;
  /** e.g. set `document.documentElement.lang` on web. */
  onLanguageChangedUI?: (language: string) => void;
};

/**
 * Single shared i18next instance for web and React Native.
 * Call once at app entry with platform-specific hooks (storage, document, etc.).
 */
export function initMonevoI18n(
  hooks: MonevoI18nPlatformHooks = {}
): typeof i18n {
  if (i18n.isInitialized) {
    return i18n;
  }

  const getInitial =
    hooks.getInitialLanguage ?? (() => normalizeLanguage(undefined));

  i18n.use(initReactI18next).init({
    resources: {
      en: { common: en },
      ro: { common: ro },
    },
    lng: getInitial(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: supportedLanguageCodes,
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

  i18n.on("languageChanged", (language) => {
    hooks.persistLanguage?.(language);
    hooks.onLanguageChangedUI?.(language);
  });

  return i18n;
}

export { i18n, normalizeLanguage };
export default i18n;
