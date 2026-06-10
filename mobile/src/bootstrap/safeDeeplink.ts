const ALLOWED_EXTERNAL_HOSTS = new Set(["garzoni.app", "www.garzoni.app"]);

const INTERNAL_PATH_RE = /^\/[a-zA-Z0-9/_-]+$/;

export function isSafePushDeeplink(target: string): boolean {
  const trimmed = target.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("garzoni://")) {
    const path = trimmed.replace(/^garzoni:\/\//, "/").split(/[?#]/)[0] ?? "";
    return INTERNAL_PATH_RE.test(path.startsWith("/") ? path : `/${path}`);
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return false;
    return INTERNAL_PATH_RE.test(trimmed.split(/[?#]/)[0] ?? trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./, "");
    return ALLOWED_EXTERNAL_HOSTS.has(host) || host.endsWith(".garzoni.app");
  } catch {
    return false;
  }
}
