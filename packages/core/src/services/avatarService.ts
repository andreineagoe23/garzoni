import apiClient from "./httpClient";

export type AvatarUpdateResponse = {
  status: string;
  avatar_url: string;
};

export function updateAvatar(url: string) {
  return apiClient.post<AvatarUpdateResponse>("/update-avatar/", {
    profile_avatar: url,
  });
}

export const AVATAR_STYLES = [
  { id: "avataaars", nameKey: "profile.avatarSelector.styles.people" },
  { id: "bottts", nameKey: "profile.avatarSelector.styles.robots" },
  { id: "initials", nameKey: "profile.avatarSelector.styles.initials" },
  { id: "micah", nameKey: "profile.avatarSelector.styles.micah" },
  { id: "adventurer", nameKey: "profile.avatarSelector.styles.adventurer" },
] as const;

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];

export function getDicebearUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}&size=256`;
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}
