/**
 * Resolve the backend user PK from the SimpleJWT access token's `user_id`
 * claim. Fallback for when the profile payload isn't loaded yet (or an older
 * backend omits `user.id`) — RevenueCat must NEVER purchase under an
 * anonymous session for an authenticated user, because the backend grant
 * path only resolves the RC subscriber keyed by str(user.pk).
 */

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlDecode(input: string): string | null {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    if (ch === "=") break;
    const v = B64_ALPHABET.indexOf(ch);
    if (v === -1) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

export function userIdFromAccessToken(
  accessToken: string | null | undefined,
): string | undefined {
  if (!accessToken) return undefined;
  const payloadPart = accessToken.split(".")[1];
  if (!payloadPart) return undefined;
  try {
    const decoded = base64UrlDecode(payloadPart);
    if (!decoded) return undefined;
    const claims = JSON.parse(decoded) as { user_id?: unknown };
    const raw = claims.user_id;
    const id = raw == null ? "" : String(raw);
    return /^\d+$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}
