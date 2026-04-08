import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "../constants/i18n";

const normalizeLanguage = (value?: string | null) => {
  if (!value) return DEFAULT_LANGUAGE;
  const lower = value.toLowerCase();
  if (lower.startsWith("ro")) return "ro";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
};

/**
 * Current app language for API headers, without importing react-i18next (shared by web and future mobile).
 */
export function getCurrentAppLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    /* ignore storage */
  }
  const browserLanguage =
    (typeof navigator !== "undefined" &&
      (navigator.languages?.[0] || navigator.language)) ||
    DEFAULT_LANGUAGE;
  return normalizeLanguage(browserLanguage);
}
