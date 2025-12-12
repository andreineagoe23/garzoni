import { useCallback } from "react";
import { recordFunnelEvent } from "services/analyticsService";

/**
 * Allowed event types that the backend accepts
 * This list should match the backend's ALLOWED_EVENT_TYPES
 */
const ALLOWED_EVENT_TYPES = new Set([
  "pricing_view",
  "checkout_created",
  "checkout_completed",
  "entitlement_lookup",
  "webhook_received",
  "dashboard_view",
  "cta_click",
  "weak_skill_click",
  "sort_change",
  "filter_change",
  "improve_recommendation_click",
]);

/**
 * Hook for tracking dashboard analytics events
 */
export const useAnalytics = () => {
  const trackEvent = useCallback((eventType, metadata = {}) => {
    // Skip tracking if event type is not allowed (fail silently)
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `Analytics event type "${eventType}" is not in allowed list. Skipping.`
        );
      }
      return;
    }

    try {
      recordFunnelEvent(eventType, {
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          path: window.location.pathname,
        },
      }).catch((error) => {
        // Silently fail analytics - don't break the UI
        // Only log in development to avoid console noise
        if (process.env.NODE_ENV === "development") {
          console.warn("Analytics tracking failed:", error);
        }
      });
    } catch (error) {
      // Only log in development
      if (process.env.NODE_ENV === "development") {
        console.warn("Analytics tracking error:", error);
      }
    }
  }, []);

  return { trackEvent };
};
