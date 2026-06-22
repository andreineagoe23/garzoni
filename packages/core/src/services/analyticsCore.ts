/**
 * Platform-agnostic analytics registry.
 *
 * Each app registers an adapter at startup so every call site shares one
 * `trackAnalyticsEvent` vocabulary (event names live in ../types/analytics):
 *   - web    → @amplitude/analytics-browser     (see ./analyticsClient)
 *   - mobile → @amplitude/analytics-react-native (see mobile bootstrap)
 *
 * This module imports no SDK, so it is safe to export from the core index and
 * pull into the React Native bundle without dragging in the browser SDK.
 */
export interface AnalyticsAdapter {
  init: () => void;
  track: (eventName: string, properties: Record<string, unknown>) => void;
}

let adapter: AnalyticsAdapter | null = null;
let didInit = false;

export function configureAnalyticsAdapter(next: AnalyticsAdapter): void {
  adapter = next;
}

export function initAnalytics(): void {
  if (didInit || !adapter) return;
  didInit = true;
  adapter.init();
}

export function trackAnalyticsEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
): void {
  adapter?.track(eventName, properties);
}
