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
  // Simulator shares the Mac's localhost — use 127.0.0.1 unconditionally so it
  // always works regardless of which Wi-Fi network the Mac is on.
  if (!Constants.isDevice) {
    return "http://localhost:8000/api";
  }

  const extra = (Constants.expoConfig?.extra ??
    (Constants as { manifest2?: { extra?: Record<string, unknown> } }).manifest2
      ?.extra ??
    (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest
      ?.extra) as Record<string, unknown> | undefined;

  const fromExtra =
    typeof extra?.backendUrl === "string" && extra.backendUrl.trim()
      ? extra.backendUrl.trim()
      : undefined;

  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || undefined;

  // In development, local env wins so a physical device can point at a Docker backend.
  const isDev =
    extra?.appEnv === "development" ||
    process.env.EXPO_PUBLIC_APP_ENV === "development";
  if (isDev && fromEnv) return preferHttpsForRailway(fromEnv);

  // For production/preview: binary-baked extra is authoritative (not subject to
  // Metro env-inlining quirks); fall back to process.env if extra is missing.
  if (fromExtra) return preferHttpsForRailway(fromExtra);
  if (fromEnv) return preferHttpsForRailway(fromEnv);

  return undefined;
}
