import { readPublicEnv } from "../env/publicEnv";

const getBackendUrl = () => {
  const envUrl = readPublicEnv("VITE_BACKEND_URL", "REACT_APP_BACKEND_URL");
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, host } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const apiPort =
      readPublicEnv("VITE_BACKEND_PORT", "REACT_APP_BACKEND_PORT") || "8000";

    if (isLocalhost) {
      return `${protocol}//${hostname}:${apiPort}/api`;
    }

    return `${protocol}//${host}/api`;
  }

  return "http://localhost:8000/api";
};

export const BACKEND_URL = getBackendUrl();

/** Google OAuth client ID for One Tap / Sign-in button (same as backend GOOGLE_OAUTH_CLIENT_ID). */
export const GOOGLE_OAUTH_CLIENT_ID =
  readPublicEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", "REACT_APP_GOOGLE_OAUTH_CLIENT_ID") ||
  "";
