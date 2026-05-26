import apiClient from "./httpClient";

export type FeedEventType =
  | "mission_completed"
  | "badge_earned"
  | "duel_won"
  | "streak_milestone";

export type FeedUser = {
  id: number;
  username: string;
  profile_avatar?: string | null;
};

export type FeedEvent = {
  type: FeedEventType;
  at: string | null;
  user: FeedUser;
  mission_name?: string | null;
  badge_name?: string | null;
  badge_level?: string | null;
  bonus_xp?: number | null;
  streak_count?: number | null;
};

export type FriendSuggestion = FeedUser & {
  reason: "mutual" | "top";
  mutual_count: number;
  points: number;
};

export type UserSearchResult = FeedUser & {
  points: number;
};

export const fetchFriendActivityFeed = () =>
  apiClient.get<FeedEvent[]>("/friends/activity-feed/");

export const fetchFriendSuggestions = () =>
  apiClient.get<FriendSuggestion[]>("/friends/suggestions/");

export const searchUsers = (query: string) =>
  apiClient.get<UserSearchResult[]>("/users/search/", {
    params: { q: query },
  });
