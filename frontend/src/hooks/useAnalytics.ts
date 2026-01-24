import { useCallback } from "react";
import { recordFunnelEvent } from "services/analyticsService";
import { trackAnalyticsEvent } from "services/analyticsClient";
import { ANALYTICS_EVENTS, type AnalyticsEvent } from "types/analytics";

/**
 * Allowed event types that the backend accepts
 * This list should match the backend's ALLOWED_EVENT_TYPES
 */
const ALLOWED_EVENT_TYPES = new Set(ANALYTICS_EVENTS);

/**
 * Hook for tracking dashboard analytics events
 */
export const useAnalytics = () => {
  const trackEvent = useCallback(
    (eventType: AnalyticsEvent, metadata: Record<string, unknown> = {}) => {
    // Skip tracking if event type is not allowed (fail silently)
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return;
    }

    try {
      trackAnalyticsEvent(eventType, {
        ...metadata,
        path: window.location.pathname,
      });
      recordFunnelEvent(eventType, {
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          path: window.location.pathname,
        },
      }).catch(() => undefined);
    } catch (error: unknown) {
      // Silently fail analytics
    }
  }, []);

  return { trackEvent };
};
