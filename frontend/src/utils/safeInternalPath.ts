const INTERNAL_PATH_RE = /^\/[a-zA-Z0-9/_-]+$/;

/**
 * Returns a safe same-origin relative path or the provided fallback.
 * Rejects protocol-relative URLs (`//evil.com`) and absolute URLs.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/all-topics"
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  const pathOnly = trimmed.split(/[?#]/)[0] ?? trimmed;
  if (!INTERNAL_PATH_RE.test(pathOnly)) return fallback;
  return pathOnly;
}
