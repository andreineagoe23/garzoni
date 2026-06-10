const ALLOWED_REDIRECT_HOSTS = new Set([
  "checkout.stripe.com",
  "billing.stripe.com",
  "connect.stripe.com",
  "js.stripe.com",
]);

/**
 * Validates absolute HTTPS redirect URLs from trusted API responses.
 */
const ALLOWED_EMBED_VIDEO_HOSTS = new Set([
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
]);

export function safeEmbedVideoUrl(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\./, "");
    if (
      !ALLOWED_EMBED_VIDEO_HOSTS.has(host) &&
      !host.endsWith(".youtube.com")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function safeRedirectUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_REDIRECT_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
