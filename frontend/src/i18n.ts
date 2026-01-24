import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// Ensure type declarations are loaded
import "./types/i18next";

const STORAGE_KEY = "monevo:lang";
const fallbackLang = "en";

// Define the resource structure type
type ResourceStructure = {
  common: Record<string, any>;
  dashboard: Record<string, any>;
  landing: Record<string, any>;
  auth: Record<string, any>;
  billing: Record<string, any>;
  tools: Record<string, any>;
  profile: Record<string, any>;
};

// Temporary empty resources - will be replaced with new language approach
export const resources: {
  en: ResourceStructure;
  es: ResourceStructure;
} = {
  en: {
    common: {},
    dashboard: {},
    landing: {},
    auth: {},
    billing: {},
    tools: {},
    profile: {},
  },
  es: {
    common: {},
    dashboard: {},
    landing: {},
    auth: {},
    billing: {},
    tools: {},
    profile: {},
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

export const defaultNS = "common" as const;

i18n.use(initReactI18next).init({
  resources: resources as typeof resources,
  lng: getInitialLang(),
  fallbackLng: fallbackLang,
  ns: ["common", "dashboard", "landing", "auth", "billing", "tools", "profile"],
  defaultNS,
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
