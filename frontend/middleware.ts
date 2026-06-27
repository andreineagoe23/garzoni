import { next, rewrite } from "@vercel/edge";

const AI_BOT_RE =
  /googlebot|google-extended|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-searchbot|perplexitybot|bytespider|meta-externalagent|cohere-ai|anthropic-ai|applebot|bingbot/i;

const SKIP_RE =
  /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|webp|gif|json|xml|txt)$/i;

export default function middleware(request: Request) {
  const url = new URL(request.url);

  if (SKIP_RE.test(url.pathname)) return next();
  if (url.pathname.startsWith("/api/")) return next();

  const ua = request.headers.get("user-agent") || "";
  if (!AI_BOT_RE.test(ua)) return next();

  const prerenderedPath =
    url.pathname === "/"
      ? "/__prerendered/index.html"
      : `/__prerendered${url.pathname}.html`;

  return rewrite(new URL(prerenderedPath, request.url));
}

export const config = {
  matcher: ["/((?!_next|_vercel|__prerendered).*)"],
};
