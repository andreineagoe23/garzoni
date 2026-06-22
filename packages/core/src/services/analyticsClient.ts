/**
 * Web analytics adapter (@amplitude/analytics-browser).
 *
 * Reachable only from the web app (frontend aliases `services/*` → core
 * services), so the browser SDK never enters the React Native bundle. Importing
 * this module registers the browser adapter with the shared analytics registry;
 * `initAnalytics` / `trackAnalyticsEvent` are re-exported from the registry so
 * existing web call sites keep their import path unchanged.
 */
import { init, track } from "@amplitude/analytics-browser";
import { readPublicEnv } from "../runtime/publicEnv";
import {
  configureAnalyticsAdapter,
  initAnalytics,
  trackAnalyticsEvent,
} from "./analyticsCore";

let amplitudeReady = false;

configureAnalyticsAdapter({
  init() {
    const apiKey = readPublicEnv(
      "VITE_AMPLITUDE_API_KEY",
      "REACT_APP_AMPLITUDE_API_KEY",
    );
    if (!apiKey) return;
    init(apiKey, undefined, {
      defaultTracking: {
        sessions: true,
        pageViews: true,
        formInteractions: true,
      },
    });
    amplitudeReady = true;
  },
  track(eventName, properties) {
    if (!amplitudeReady) return;
    track(eventName, properties);
  },
});

export { initAnalytics, trackAnalyticsEvent };
