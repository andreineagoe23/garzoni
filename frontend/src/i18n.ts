import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import commonEn from "./locales/en/common.json";
import dashboardEn from "./locales/en/dashboard.json";
import landingEn from "./locales/en/landing.json";
import authEn from "./locales/en/auth.json";
import billingEn from "./locales/en/billing.json";
import toolsEn from "./locales/en/tools.json";
import commonEs from "./locales/es/common.json";
import dashboardEs from "./locales/es/dashboard.json";
import landingEs from "./locales/es/landing.json";
import authEs from "./locales/es/auth.json";
import billingEs from "./locales/es/billing.json";
import toolsEs from "./locales/es/tools.json";
import profileEn from "./locales/en/profile.json";
import profileEs from "./locales/es/profile.json";

const STORAGE_KEY = "monevo:lang";
const fallbackLang = "en";

const resources = {
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    landing: landingEn,
    auth: authEn,
    billing: billingEn,
    tools: toolsEn,
    profile: profileEn,
  },
  es: {
    common: commonEs,
    dashboard: dashboardEs,
    landing: landingEs,
    auth: authEs,
    billing: billingEs,
    tools: toolsEs,
    profile: profileEs,
  },
};

const getInitialLang = () => {
  if (typeof window === "undefined") return fallbackLang;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && resources[stored]) return stored;
  const browserLang = window.navigator.language?.split("-")[0];
  if (browserLang && resources[browserLang]) return browserLang;
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
});

if (typeof window !== "undefined") {
  document.documentElement.lang = i18n.language || fallbackLang;
}

export const setLanguage = (lang: string) => {
  if (!resources[lang]) return;
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
};

export const supportedLanguages = Object.keys(resources);

export default i18n;
