import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "../constants/i18n";

const normalizeLanguage = (value?: string | null) => {
  if (!value) return DEFAULT_LANGUAGE;
  const lower = value.toLowerCase();
  if (lower.startsWith("ro")) return "ro";
  if (lower.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
};

/** React Native / tests: set from host after i18n init so API headers match UI language. */
let languageResolver: (() => string) | null = null;

/**
 * Register how to read the active UI language for HTTP headers (e.g. `() => i18n.language`).
 * Pass `null` to clear. Web can omit this and rely on `localStorage` + `navigator`.
 */
export function setAppLanguageResolver(resolver: (() => string) | null): void {
  languageResolver = resolver;
}

/**
 * Current app language for API headers, without importing react-i18next in the axios layer.
 * Order: native resolver (Expo), then browser storage + navigator, else default.
 */
export function getCurrentAppLanguage(): string {
  if (languageResolver) {
    try {
      return normalizeLanguage(languageResolver());
    } catch {
      /* fall through */
    }
  }
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
