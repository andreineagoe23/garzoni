/**
 * Mobile analytics helper — mirror of web's useAnalytics hook.
 *
 * One call fans out to both sinks:
 *  - Amplitude (product analytics) via the shared trackAnalyticsEvent registry
 *  - backend FunnelEvent ingest (admin analytics dashboard) via recordFunnelEvent
 *
 * Event names must exist in ANALYTICS_EVENTS (packages/core/src/types/analytics)
 * AND the backend's FunnelEventIngestView.ALLOWED_EVENT_TYPES, or the funnel
 * write is rejected with a 400.
 */
import {
  recordFunnelEvent,
  trackAnalyticsEvent,
  type AnalyticsEvent,
} from "@garzoni/core";

export function trackEvent(
  event: AnalyticsEvent,
  metadata: Record<string, unknown> = {},
): void {
  try {
    trackAnalyticsEvent(event, metadata);
    void recordFunnelEvent(event, {
      metadata: { ...metadata, timestamp: new Date().toISOString() },
    }).catch(() => undefined);
  } catch {
    // Analytics must never break UX.
  }
}
