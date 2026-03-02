import { init, track } from "@amplitude/analytics-browser";

let isInitialized = false;

export const initAnalytics = () => {
  const apiKey = process.env.REACT_APP_AMPLITUDE_API_KEY;
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
