export const ANALYTICS_EVENTS = [
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
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
