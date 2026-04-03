import Constants from "expo-constants";

/**
 * API base URL for native: prefer `app.config.js` extra (EAS), then env inlined by Metro.
 * Must be the Django API origin; `/api` is appended by @monevo/core if missing.
 */
export function resolveBackendUrlFromExpo(): string | undefined {
  const extra =
    (Constants.expoConfig?.extra ??
      (Constants as { manifest2?: { extra?: Record<string, unknown> } }).manifest2
        ?.extra ??
      (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra) as
      | Record<string, unknown>
      | undefined;

  const fromExtra = extra?.backendUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }

  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (fromEnv) return fromEnv;

  return undefined;
}
