import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@garzoni/core/locales/en";

// Minimal i18n instance for component tests (EN only)
i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      common: en,
    },
  },
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export default i18n;
