import { readPublicEnv } from "../runtime/publicEnv";

/** Normalize env base to a single /api suffix (no trailing slash after api). */
function normalizeBackendApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

let backendUrlOverride: string | null = null;

/**
 * Override API base at runtime (required for Expo/Metro when env is not baked into import.meta).
 * Web can omit this if `VITE_BACKEND_URL` / `REACT_APP_BACKEND_URL` / same-origin inference is enough.
 */
export function configureBackendUrl(url: string): void {
  backendUrlOverride = normalizeBackendApiBase(url);
  BACKEND_URL = backendUrlOverride;
}

function inferBackendUrl(): string {
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
    if (proto === "https:") {
      return `${origin}/api`;
    }
    if (proto === "http:") {
      return `${protocol}//${host}/api`;
    }
  }

  return "http://localhost:8000/api";
}

/** Current API base (`.../api`), including any {@link configureBackendUrl} override. */
export function getBackendUrl(): string {
  if (backendUrlOverride !== null) {
    return backendUrlOverride;
  }
  return inferBackendUrl();
}

/** Live binding; prefer {@link getBackendUrl} after startup if the host may call `configureBackendUrl`. */
export let BACKEND_URL = getBackendUrl();

/** Public media/CDN base (strips trailing `/api` from the API base). */
export function getMediaBaseUrl(): string {
  return getBackendUrl().replace(/\/api\/?$/, "");
}

/** Google OAuth client ID for One Tap / Sign-in button (same as backend GOOGLE_OAUTH_CLIENT_ID). */
export const GOOGLE_OAUTH_CLIENT_ID =
  readPublicEnv(
    "VITE_GOOGLE_OAUTH_CLIENT_ID",
    "REACT_APP_GOOGLE_OAUTH_CLIENT_ID",
  ) || "";
