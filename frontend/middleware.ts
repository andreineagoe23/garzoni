import { next, rewrite } from "@vercel/edge";

// Crawlers, AI fetchers and link unfurlers get the prerendered HTML. Includes the
// tools Google Search Console uses (URL Inspection, Rich Results Test) and the
// user-triggered AI fetchers, which otherwise see an empty SPA shell.
const AI_BOT_RE =
  /googlebot|google-inspectiontool|googleother|google-extended|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|perplexitybot|perplexity-user|bytespider|meta-externalagent|cohere-ai|anthropic-ai|applebot|amazonbot|ccbot|mistralai-user|duckassistbot|bingbot|twitterbot|facebookexternalhit|linkedinbot|whatsapp|slackbot|telegrambot|discordbot|duckduckbot|yandex/i;

const SKIP_RE =
  /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|webp|gif|json|xml|txt)$/i;

const APP_STORE_ID = "6761790801";
const PLAY_PACKAGE = "app.garzoni.mobile";

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
    const pt = process.env.VITE_APPLE_PROVIDER_TOKEN;
    return Response.redirect(
      `https://apps.apple.com/gb/app/garzoni-personal-finance/id${APP_STORE_ID}?ct=web_${campaign}&mt=8${pt ? `&pt=${pt}` : ""}`,
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

  if (!AI_BOT_RE.test(ua)) return next();

  const prerenderedPath =
    url.pathname === "/"
      ? "/__prerendered/index.html"
      : `/__prerendered${url.pathname}.html`;

  // A slug with no snapshot (dead or never published) is turned into a real 404
  // by the /__prerendered rewrite in vercel.json, not served the 200 SPA shell.
  return rewrite(new URL(prerenderedPath, request.url));
}

export const config = {
  matcher: ["/((?!_next|_vercel|__prerendered).*)"],
};
