import apiClient from "./httpClient";

export const recordFunnelEvent = (eventType, payload = {}) =>
  apiClient.post("/finance/funnel/events/", {
    event_type: eventType,
    ...payload,
  });

export const fetchFunnelMetrics = (params = {}) =>
  apiClient.get("/finance/funnel/metrics/", { params });

export const fetchEntitlements = () => apiClient.get("/finance/entitlements/");

