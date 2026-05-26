import apiClient from "./httpClient";

export type DuelStatus =
  | "pending"
  | "active"
  | "won_by_challenger"
  | "won_by_opponent"
  | "draw"
  | "declined"
  | "cancelled"
  | "expired";

export type DuelParticipant = {
  id: number;
  username: string;
  profile_avatar?: string | null;
  xp_delta: number;
};

export type DuelRecord = {
  id: number;
  status: DuelStatus;
  duration_hours: number;
  bonus_xp: number;
  created_at: string | null;
  accepted_at: string | null;
  ends_at: string | null;
  finished_at: string | null;
  challenger: DuelParticipant;
  opponent: DuelParticipant;
  winner_id: number | null;
  viewer_role: "challenger" | "opponent" | "observer";
};

export type DuelDuration = 24 | 72 | 168;

export const DUEL_DURATION_BONUS: Record<DuelDuration, number> = {
  24: 100,
  72: 250,
  168: 500,
};

export const fetchActiveDuels = () =>
  apiClient.get<DuelRecord[]>("/duels/");

export const fetchDuelHistory = () =>
  apiClient.get<DuelRecord[]>("/duels/history/");

export const fetchDuelDetail = (duelId: number) =>
  apiClient.get<DuelRecord>(`/duels/${duelId}/`);

export const createDuel = (opponentId: number, durationHours: DuelDuration) =>
  apiClient.post<DuelRecord>("/duels/", {
    opponent_id: opponentId,
    duration_hours: durationHours,
  });

export const respondToDuel = (duelId: number, action: "accept" | "decline") =>
  apiClient.post<DuelRecord>(`/duels/${duelId}/respond/`, { action });

export const cancelDuel = (duelId: number) =>
  apiClient.post<DuelRecord>(`/duels/${duelId}/cancel/`, {});

export const finalizeDuel = (duelId: number) =>
  apiClient.post<DuelRecord>(`/duels/${duelId}/finalize/`, {});
