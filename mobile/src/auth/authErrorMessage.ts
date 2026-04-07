import { getBackendUrl } from "@garzoni/core";

/** User-facing message for password / register failures (includes offline / wrong API URL). */
export function formatAuthRequestError(
  e: unknown,
  fallback: string
): string {
  const err = e as {
    response?: { status?: number; data?: { detail?: string } };
    message?: string;
    code?: string;
  };

  if (!err.response) {
    const api = getBackendUrl();
    const msg = (err.message || String(e || "")).toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("failed to connect") ||
      msg.includes("timeout") ||
      msg.includes("load failed") ||
      err.code === "ECONNABORTED" ||
      err.code === "ERR_NETWORK"
    ) {
      return `Cannot reach the server (${api}). Set EXPO_PUBLIC_BACKEND_URL in mobile/.env to your public API URL (e.g. Railway), restart Expo with --clear, and try again.`;
    }
    return `Cannot reach the server (${api}). Check your connection and API URL.`;
  }

  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  return fallback;
}
