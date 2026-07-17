import { getBackendUrl } from "services/backendUrl";

function resolveAbsoluteApiRoot(pageOrigin: string): string {
  const raw = (getBackendUrl() || "").trim().replace(/\/+$/, "");
  if (!raw) {
    return new URL("/api", `${pageOrigin}/`).href.replace(/\/+$/, "");
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return new URL(path, `${pageOrigin}/`).href.replace(/\/+$/, "");
}

/**
 * Google OAuth init URL. Embeds the current SPA origin in `state` so the backend
 * redirects to /auth/callback on this host after Google (not only settings.FRONTEND_URL).
 *
 * Always returns an absolute https? URL so the browser never treats `v1.*` state as a path
 * on the current site (can happen if the API base were wrongly relative).
 *
 * Tap-to-consent (mobile parity): when `options.consent` is set, the state
 * payload also carries `accept_terms: true` / `age_confirmed: true`, mirroring
 * the mobile GoogleSignInButton pattern. The backend's redirect callback
 * already records consent server-side for new users (views_google_oauth.py)
 * and its state parser ignores unknown keys, so this is an explicit,
 * forward-compatible signal — the button tap itself is the consent action
 * (a caption under the button states the terms).
 */
export function buildGoogleOAuthInitHref(
  nextPath: string,
  options?: { consent?: boolean }
): string {
  const pageOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  const apiRoot = resolveAbsoluteApiRoot(pageOrigin);
  const apiSlash = apiRoot.endsWith("/") ? apiRoot : `${apiRoot}/`;
  const initUrl = new URL("auth/google/", apiSlash);

  const payload: Record<string, unknown> = {
    next: nextPath,
    origin: pageOrigin,
  };
  if (options?.consent) {
    payload.accept_terms = true;
    payload.age_confirmed = true;
  }
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const state = `v1.${b64}`;
  initUrl.searchParams.set("state", state);
  return initUrl.toString();
}
