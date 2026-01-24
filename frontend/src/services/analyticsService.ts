import apiClient from "./httpClient";
import type { Entitlements } from "types/api";

export const recordFunnelEvent = (
  eventType: string,
  payload: Record<string, unknown> = {}
) =>
  apiClient.post("/funnel/events/", {
    event_type: eventType,
    ...payload,
  });

export const fetchFunnelMetrics = (params: Record<string, unknown> = {}) =>
  apiClient.get("/funnel/metrics/", { params });

export const fetchEntitlements = () =>
  apiClient.get<Entitlements>("/finance/entitlements/");
