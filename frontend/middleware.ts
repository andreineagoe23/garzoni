import { next, rewrite } from "@vercel/edge";

// Crawlers, AI fetchers and link unfurlers get the prerendered HTML. Includes the
// tools Google Search Console uses (URL Inspection, Rich Results Test) and the
// user-triggered AI fetchers, which otherwise see an empty SPA shell.
const AI_BOT_RE =
  /googlebot|google-inspectiontool|googleother|google-extended|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|perplexitybot|perplexity-user|bytespider|meta-externalagent|cohere-ai|anthropic-ai|applebot|amazonbot|ccbot|mistralai-user|duckassistbot|bingbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|slackbot|telegrambot|discordbot|duckduckbot|yandex/i;

// Public content every visitor gets as its prerendered snapshot, not only
// crawlers; the app takes over in the browser (src/bootstrap/prerenderHandoff.ts).
// "/" and "/ro" stay crawler-only: the landing replays its entrance animations
// when the app re-renders it, and "/" follows the visitor's UI language.
// App routes (/login, /tools, /lessons, ...) never match.
const VISITOR_SNAPSHOT_RE =
  /^\/(?:(?:ro\/)?(?:learn|guides)(?:\/[^/]+)?|(?:ro\/)?calculators\/[^/]+|authors\/[^/]+|about|editorial-standards|privacy-policy|cookie-policy|terms-of-service|financial-disclaimer)$/;

// public/404.html sends a visitor whose lesson or guide has no snapshot (published
// after this deploy) back with this flag, and they get the SPA, which renders it.
// Crawlers ignore it and keep the 404.
const SPA_FALLBACK_PARAM = "_spa";

const SKIP_RE =
  /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|webp|gif|json|xml|txt)$/i;

const APP_STORE_ID = "6761790801";
const PLAY_PACKAGE = "app.garzoni.mobile";
const APPLE_PROVIDER_TOKEN = "128738216";

/** `/get` — one link for QR codes, bios and emails: the right store per device. */
function storeRedirect(ua: string, campaign: string): Response {
  if (/android/i.test(ua)) {
    const referrer = `utm_source=garzoni_web&utm_medium=web&utm_campaign=${campaign}`;
    return Response.redirect(
      `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(referrer)}`,
      302
    );
  }
  if (/iphone|ipad|ipod|macintosh/i.test(ua)) {
    return Response.redirect(
      `https://apps.apple.com/gb/app/garzoni-personal-finance/id${APP_STORE_ID}?pt=${APPLE_PROVIDER_TOKEN}&ct=web_${campaign}&mt=8`,
      302
    );
  }
  return Response.redirect("https://www.garzoni.app/", 302);
}

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") || "";

  if (url.pathname === "/get") {
    return storeRedirect(ua, url.searchParams.get("c") || "get");
  }

  if (SKIP_RE.test(url.pathname)) return next();
  if (url.pathname.startsWith("/api/")) return next();

  if (
    !AI_BOT_RE.test(ua) &&
    (!VISITOR_SNAPSHOT_RE.test(url.pathname) ||
      url.searchParams.has(SPA_FALLBACK_PARAM))
  ) {
    return next();
  }

  const prerenderedPath =
    url.pathname === "/"
      ? "/__prerendered/index.html"
      : `/__prerendered${url.pathname}.html`;

  // A /learn, /guides or /authors slug with no snapshot (dead or never published)
  // gets a real 404 (public/404.html): vercel.json's SPA catch-all skips those
  // /__prerendered paths, so a missing file isn't turned into a 200 shell. Any
  // other missing snapshot falls through to that catch-all, i.e. the SPA.
  return rewrite(new URL(prerenderedPath, request.url));
}

export const config = {
  matcher: ["/((?!_next|_vercel|__prerendered).*)"],
};
