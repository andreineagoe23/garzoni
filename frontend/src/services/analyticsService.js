import apiClient from "./httpClient";

export const recordFunnelEvent = (eventType, payload = {}) =>
  apiClient.post("/funnel/events/", {
    event_type: eventType,
    ...payload,
  });

export const fetchFunnelMetrics = (params = {}) =>
  apiClient.get("/funnel/metrics/", { params });

export const fetchEntitlements = () => apiClient.get("/finance/entitlements/");

