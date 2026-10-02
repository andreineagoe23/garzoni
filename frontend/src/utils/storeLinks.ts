/**
 * App store links that carry where on the site the click came from, so App Store
 * Connect (campaign `ct`, needs the provider token `pt`) and Play Console (install
 * referrer `utm_*`) can attribute web-driven installs.
 */
const APP_STORE_ID = "6761790801";
const PLAY_PACKAGE = "app.garzoni.mobile";
const APPLE_PROVIDER_TOKEN = import.meta.env.VITE_APPLE_PROVIDER_TOKEN || "";

export function appStoreUrl(placement: string): string {
  const params = new URLSearchParams({ ct: `web_${placement}`, mt: "8" });
  if (APPLE_PROVIDER_TOKEN) params.set("pt", APPLE_PROVIDER_TOKEN);
  return `https://apps.apple.com/gb/app/garzoni-personal-finance/id${APP_STORE_ID}?${params}`;
}

export function playStoreUrl(placement: string): string {
  const referrer = new URLSearchParams({
    utm_source: "garzoni_web",
    utm_medium: "web",
    utm_campaign: placement,
  });
  const params = new URLSearchParams({
    id: PLAY_PACKAGE,
    referrer: `${referrer}`,
  });
  return `https://play.google.com/store/apps/details?${params}`;
}

export type MobileOs = "ios" | "android" | null;

export function detectMobileOs(): MobileOs {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS reports a desktop Safari UA; touch support gives it away.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  return null;
}

/** The store for this device; App Store on desktop (UK-first audience). */
export function storeUrlForDevice(placement: string): string {
  return detectMobileOs() === "android"
    ? playStoreUrl(placement)
    : appStoreUrl(placement);
}
