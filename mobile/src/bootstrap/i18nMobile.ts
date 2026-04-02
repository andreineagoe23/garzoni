import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_LANGUAGE,
  initMonevoI18n,
  i18n,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from "@monevo/core";

let initialized = false;

export function initI18nMobile() {
  if (initialized) return;
  initialized = true;

  initMonevoI18n({
    getInitialLanguage: () => DEFAULT_LANGUAGE,
    persistLanguage: (language) => {
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    },
    onLanguageChangedUI: () => {},
  });

  void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((raw) => {
    const lng = normalizeLanguage(raw ?? undefined);
    if (lng && lng !== i18n.language) {
      void i18n.changeLanguage(lng);
    }
  });
}
