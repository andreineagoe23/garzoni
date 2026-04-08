import Constants from "expo-constants";

/** Railway serves HTTPS; `http://` often fails from iOS (ATS) or returns redirects that break clients. */
export function preferHttpsForRailway(url: string): string {
  const t = url.trim();
  try {
    const u = new URL(t);
    if (u.protocol === "http:" && /\.railway\.app$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.href.replace(/\/+$/, "");
    }
  } catch {
    /* ignore */
  }
  return t;
}

/**
 * API base URL for native: prefer `app.config.js` extra (EAS), then env inlined by Metro.
 * Must be the Django API origin; `/api` is appended by @garzoni/core if missing.
 */
export function resolveBackendUrlFromExpo(): string | undefined {
  const extra = (Constants.expoConfig?.extra ??
    (Constants as { manifest2?: { extra?: Record<string, unknown> } }).manifest2
      ?.extra ??
    (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest
      ?.extra) as Record<string, unknown> | undefined;

  const fromExtra = extra?.backendUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return preferHttpsForRailway(fromExtra.trim());
  }

  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (fromEnv) return preferHttpsForRailway(fromEnv);

  return undefined;
}
