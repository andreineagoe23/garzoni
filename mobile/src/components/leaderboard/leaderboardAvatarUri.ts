import { getMediaBaseUrl } from "@garzoni/core";

export function leaderboardAvatarUri(
  profileAvatar: string | null | undefined
): string | undefined {
  if (!profileAvatar) return undefined;
  const s = String(profileAvatar);
  if (s.startsWith("http")) return s;
  return `${getMediaBaseUrl()}/media/${s.replace(/^\/+/, "")}`;
}
