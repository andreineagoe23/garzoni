import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * Language of a public SEO page (/learn, /guides and their /ro/ twins).
 *
 * The URL decides, never the reader's UI language: /learn is the English page and
 * /ro/learn the Romanian one, so each URL renders one language for every visitor
 * and crawler — which is what its hreflang annotation promises.
 */
export type PublicLang = "en" | "ro";

export const SITE_URL = "https://www.garzoni.app";

export function publicLangFromPath(pathname: string): PublicLang {
  return pathname === "/ro" || pathname.startsWith("/ro/") ? "ro" : "en";
}

/** "/learn/x" → "/ro/learn/x" for Romanian; English paths are unprefixed. */
export function localizedPath(path: string, lang: PublicLang): string {
  return lang === "ro" ? `/ro${path}` : path;
}

/**
 * The page's 1200×630 share card, drawn at build time by scripts/og-card.mjs
 * (shareCardUrl there must produce the same URL). Takes the localized path.
 */
export function shareImageUrl(path: string): string {
  return `${SITE_URL}/og${path}.jpg`;
}

/**
 * hreflang set for a page that exists in both languages; undefined otherwise, so a
 * page never advertises a version that would 404.
 */
export function hreflangAlternates(
  path: string,
  availableLanguages: string[] | undefined
): Array<{ hrefLang: string; href: string }> | undefined {
  if (
    !availableLanguages?.includes("en") ||
    !availableLanguages.includes("ro")
  ) {
    return undefined;
  }
  return [
    { hrefLang: "en", href: `${SITE_URL}${path}` },
    { hrefLang: "ro", href: `${SITE_URL}${localizedPath(path, "ro")}` },
    { hrefLang: "x-default", href: `${SITE_URL}${path}` },
  ];
}

export function usePublicLocale() {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const lang = publicLangFromPath(pathname);
  const t = useMemo(() => i18n.getFixedT(lang), [i18n, lang]);
  return {
    lang,
    t,
    /** Localized in-app path, e.g. to("/learn") → "/ro/learn". */
    to: (path: string) => localizedPath(path, lang),
    /** Absolute canonical URL for this language. */
    url: (path: string) => `${SITE_URL}${localizedPath(path, lang)}`,
    /** This language's share card for a page, e.g. ".../og/ro/learn/x.jpg". */
    shareImage: (path: string) => shareImageUrl(localizedPath(path, lang)),
    dateLocale: lang === "ro" ? "ro-RO" : "en-GB",
  };
}

/** Query params for /api/public/*; English sends none so its cached URLs stay as-is. */
export function publicApiParams(lang: PublicLang) {
  return lang === "ro" ? { lang } : undefined;
}
