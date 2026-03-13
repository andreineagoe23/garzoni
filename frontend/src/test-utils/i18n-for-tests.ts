import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "../locales/en/common.json";
import enShared from "../locales/en/shared.json";
import enCourses from "../locales/en/courses.json";

// Minimal i18n instance for component tests (EN only)
i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      common: enCommon,
      shared: enShared,
      courses: enCourses,
    },
  },
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export default i18n;
