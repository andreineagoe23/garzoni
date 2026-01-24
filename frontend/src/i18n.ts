import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const STORAGE_KEY = "monevo:lang";
const fallbackLang = "en";

// Temporary empty resources - will be replaced with new language approach
const resources = {
  en: {
    common: {} as Record<string, string>,
    dashboard: {} as Record<string, string>,
    landing: {} as Record<string, string>,
    auth: {} as Record<string, string>,
    billing: {} as Record<string, string>,
    tools: {} as Record<string, string>,
    profile: {} as Record<string, string>,
  },
  es: {
    common: {} as Record<string, string>,
    dashboard: {} as Record<string, string>,
    landing: {} as Record<string, string>,
    auth: {} as Record<string, string>,
    billing: {} as Record<string, string>,
    tools: {} as Record<string, string>,
    profile: {} as Record<string, string>,
  },
};

const getInitialLang = () => {
  if (typeof window === "undefined") return fallbackLang;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && resources[stored as keyof typeof resources]) return stored;
  const browserLang = window.navigator.language?.split("-")[0];
  if (browserLang && resources[browserLang as keyof typeof resources])
    return browserLang;
  return fallbackLang;
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLang(),
  fallbackLng: fallbackLang,
  ns: ["common", "dashboard", "landing", "auth", "billing", "tools", "profile"],
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v4",
});

if (typeof window !== "undefined") {
  document.documentElement.lang = i18n.language || fallbackLang;
}

export const setLanguage = (lang: string) => {
  if (!resources[lang as keyof typeof resources]) return;
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
};

export const supportedLanguages = Object.keys(resources);

export default i18n;
