import Constants from "expo-constants";

/** Google Cloud often shows the prefix only; the SDK needs `*.apps.googleusercontent.com`. */
function normalizeGoogleIosClientId(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.includes(".apps.googleusercontent.com")) return t;
  if (/^\d+-[a-zA-Z0-9]+$/.test(t)) return `${t}.apps.googleusercontent.com`;
  return t;
}

function readExtraRecord(): Record<string, unknown> {
  return (Constants.expoConfig?.extra ??
    (Constants as { manifest2?: { extra?: Record<string, unknown> } }).manifest2
      ?.extra ??
    (Constants as { manifest?: { extra?: Record<string, unknown> } }).manifest
      ?.extra ??
    {}) as Record<string, unknown>;
}

/** Web client ID (server token audience). Required for Android; iOS also uses it for idToken. */
export function getGoogleWebClientId(): string {
  const ex = readExtraRecord().googleWebClientId;
  if (typeof ex === "string" && ex.trim()) return ex.trim();
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
}

/** iOS OAuth client ID from Google Cloud Console (iOS application type). */
export function getGoogleIosClientId(): string {
  const ex = readExtraRecord().googleIosClientId;
  if (typeof ex === "string" && ex.trim())
    return normalizeGoogleIosClientId(ex);
  return normalizeGoogleIosClientId(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  );
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(getGoogleWebClientId() || getGoogleIosClientId());
}
