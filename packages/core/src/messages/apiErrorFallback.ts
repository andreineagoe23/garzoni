import { getCurrentAppLanguage } from "../utils/appLanguage";

const MESSAGES: Record<string, string> = {
  en: "Something went wrong. Please try again.",
  ro: "Ceva n-a mers bine. Te rugăm să încerci din nou.",
};

/** Fallback when i18n is not available (e.g. httpClient in @garzoni/core). */
export function getApiErrorFallbackMessage(): string {
  const lang = getCurrentAppLanguage();
  return MESSAGES[lang] ?? MESSAGES.en;
}
