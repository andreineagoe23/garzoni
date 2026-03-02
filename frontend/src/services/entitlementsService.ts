import apiClient from "./httpClient";
import type { Entitlements } from "types/api";

export const fetchEntitlements = () =>
  apiClient.get<Entitlements>("/entitlements/");

export const consumeEntitlement = (feature: string) =>
  apiClient.post("/entitlements/consume/", { feature });

export const FEATURE_COPY = {
  daily_limits: "Daily learning limit",
  hints: "Lesson & quiz hints",
  streak_repair: "Streak repair",
  downloads: "Downloads",
  analytics: "Analytics & insights",
  ai_tutor: "AI tutor",
  personalized_path: "Personalized path",
};
