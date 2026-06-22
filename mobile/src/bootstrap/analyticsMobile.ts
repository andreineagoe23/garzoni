/**
 * Mobile analytics adapter (@amplitude/analytics-react-native).
 *
 * Registers the React Native Amplitude SDK with the shared analytics registry
 * in @garzoni/core so mobile call sites use the same `trackAnalyticsEvent`
 * vocabulary as web. No-ops without EXPO_PUBLIC_AMPLITUDE_API_KEY, so it is safe
 * to call unconditionally at startup.
 *
 * NOTE: this is a native dependency — adding it requires a fresh EAS dev build
 * (`eas build --profile development`); it will not load over OTA / Expo Go.
 */
import { init, track } from "@amplitude/analytics-react-native";
import { configureAnalyticsAdapter, initAnalytics } from "@garzoni/core";

const apiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY?.trim();
let ready = false;

/** Register the RN Amplitude adapter, then run the shared analytics init. */
export function initAnalyticsMobile(): void {
  configureAnalyticsAdapter({
    init() {
      if (!apiKey) return;
      // RN SDK tracks sessions by default; no DOM pageViews/form options here.
      void init(apiKey);
      ready = true;
    },
    track(eventName, properties) {
      if (!ready) return;
      void track(eventName, properties);
    },
  });
  initAnalytics();
}
