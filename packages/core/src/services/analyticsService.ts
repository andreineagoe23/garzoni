import apiClient from "./httpClient";
import type { Entitlements } from "types/api";

/** Strip non-JSON values so Django's JSONField always receives a plain object. */
function jsonSafeMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const s = JSON.stringify(meta, (_k, v) =>
      v === undefined ? undefined : v,
    );
    return s ? (JSON.parse(s) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const recordFunnelEvent = (
  eventType: string,
  payload: Record<string, unknown> = {},
) => {
  const rawMeta =
    payload.metadata && typeof payload.metadata === "object" && payload.metadata
      ? (payload.metadata as Record<string, unknown>)
      : {};
  const body: Record<string, unknown> = {
    event_type: eventType,
    ...payload,
    metadata: jsonSafeMetadata(rawMeta),
  };
  return apiClient.post("/funnel/events/", body, {
    skipGlobalErrorToast: true,
  });
};

export const fetchFunnelMetrics = (params: Record<string, unknown> = {}) =>
  apiClient.get("/funnel/metrics/", { params });

export const fetchEntitlements = () =>
  apiClient.get<Entitlements>("/finance/entitlements/");
