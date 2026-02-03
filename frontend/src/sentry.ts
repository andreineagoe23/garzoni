import * as Sentry from "@sentry/react";
import { browserTracingIntegration } from "@sentry/react";

const dsn = process.env.REACT_APP_SENTRY_DSN;

export const initSentry = () => {
  if (!dsn) return;
  Sentry.init({
    dsn,
    integrations: [browserTracingIntegration()],
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

export const captureMessage = (
  message: string,
  level: "info" | "warning" | "error" = "info",
  extra?: Record<string, unknown>
) => {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    if (extra) scope.setContext("tool", extra);
    scope.setLevel(level);
    Sentry.captureMessage(message);
  });
};
