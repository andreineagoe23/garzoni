import { init, track } from "@amplitude/analytics-browser";
import { readPublicEnv } from "../runtime/publicEnv";

let isInitialized = false;

export const initAnalytics = () => {
  const apiKey = readPublicEnv("VITE_AMPLITUDE_API_KEY", "REACT_APP_AMPLITUDE_API_KEY");
  if (!apiKey || isInitialized) return;
  init(apiKey, undefined, {
    defaultTracking: {
      sessions: true,
      pageViews: true,
      formInteractions: true,
    },
  });
  isInitialized = true;
};

export const trackAnalyticsEvent = (
  eventName: string,
  properties: Record<string, unknown> = {}
) => {
  if (!isInitialized) return;
  track(eventName, properties);
};
