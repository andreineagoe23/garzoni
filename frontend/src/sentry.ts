import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

const dsn = process.env.REACT_APP_SENTRY_DSN;

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    integrations: [new BrowserTracing() as any],
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
};

export const captureException = (error: unknown, info?: unknown) => {
  if (!dsn) return;
  Sentry.captureException(error, {
    extra: (info as Record<string, unknown> | undefined) ?? undefined,
  });
};
