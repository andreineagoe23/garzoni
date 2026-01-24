import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

const dsn = process.env.REACT_APP_SENTRY_DSN;

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
};

export const captureException = (error, info) => {
  if (!dsn) return;
  Sentry.captureException(error, { extra: info });
};
