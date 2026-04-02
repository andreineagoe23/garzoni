import { readPublicEnv } from "../runtime/publicEnv";

/** Normalize env base to a single /api suffix (no trailing slash after api). */
function normalizeBackendApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

const getBackendUrl = () => {
  const rawEnv = readPublicEnv("VITE_BACKEND_URL", "REACT_APP_BACKEND_URL");
  const envUrl = rawEnv?.trim();
  if (envUrl) {
    return normalizeBackendApiBase(envUrl);
  }

  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, origin, host } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const apiPort =
      readPublicEnv("VITE_BACKEND_PORT", "REACT_APP_BACKEND_PORT") || "8000";

    if (isLocalhost) {
      return `${protocol}//${hostname}:${apiPort}/api`;
    }

    const proto = (protocol || "").toLowerCase();
    // Production SPA (e.g. Vercel): same-origin /api via Edge proxy to Django.
    if (proto === "https:") {
      return `${origin}/api`;
    }
    if (proto === "http:") {
      // LAN / custom HTTP: legacy assumption that API is on the same host as the page.
      return `${protocol}//${host}/api`;
    }
  }

  return "http://localhost:8000/api";
};

export const BACKEND_URL = getBackendUrl();

/** Google OAuth client ID for One Tap / Sign-in button (same as backend GOOGLE_OAUTH_CLIENT_ID). */
export const GOOGLE_OAUTH_CLIENT_ID =
  readPublicEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", "REACT_APP_GOOGLE_OAUTH_CLIENT_ID") ||
  "";
