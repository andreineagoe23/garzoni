/**
 * Vercel Edge proxy: forwards same-origin /api/* to Django (e.g. Railway).
 * Set MONEVO_BACKEND_ORIGIN (e.g. https://your-app.up.railway.app, no trailing slash, no /api).
 */
export const config = { runtime: "edge" };

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxy(request) {
  const backend = process.env.MONEVO_BACKEND_ORIGIN?.trim();
  if (!backend || !/^https?:\/\//i.test(backend)) {
    return new Response(
      JSON.stringify({
        detail:
          "Server misconfiguration: set MONEVO_BACKEND_ORIGIN to your Django base URL (e.g. https://app.up.railway.app, no trailing slash).",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const base = backend.replace(/\/+$/, "");
  const backendUrl = new URL(base);
  const u = new URL(request.url);
  const afterApi = u.pathname.replace(/^\/api\/?/, "");
  const pathPart = afterApi ? (afterApi.startsWith("/") ? afterApi : `/${afterApi}`) : "";
  const targetUrl = `${base}/api${pathPart}${u.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Django USE_X_FORWARDED_HOST: avoid www.monevo.tech in OAuth redirect_uri / absolute URLs.
  headers.delete("x-forwarded-host");
  headers.set("host", backendUrl.host);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const res = await fetch(targetUrl, init);
  const out = new Headers(res.headers);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

export default {
  fetch: proxy,
};
