import apiClient from "./httpClient";

export const fetchEntitlements = () => apiClient.get("/entitlements/");

export const consumeEntitlement = (feature) =>
  apiClient.post("/entitlements/consume/", { feature });

export const FEATURE_COPY = {
  daily_limits: "Daily learning limit",
  hints: "Lesson & quiz hints",
  streak_repair: "Streak repair",
  downloads: "Downloads",
  analytics: "Analytics & insights",
  ai_tutor: "AI tutor",
};
