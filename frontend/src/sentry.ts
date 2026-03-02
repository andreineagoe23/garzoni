import * as Sentry from "@sentry/react";
import { browserTracingIntegration } from "@sentry/react";

// Disabled: Sentry paid in production. Set REACT_APP_SENTRY_DSN to re-enable.
const dsn = ""; // process.env.REACT_APP_SENTRY_DSN;
const isProd = process.env.NODE_ENV === "production";

/** Safe profile fields only (no PII). Use for context in errors. */
export type SafeProfileContext = {
  has_goal?: boolean;
  questionnaire_completed?: boolean;
  dark_mode?: boolean;
};

/**
 * beforeSend: scrub PII, never send every click/render/personal data.
 * Add allowed context: tool name, anonymous user, safe profile snapshot.
 */
function beforeSend(
  event: Sentry.Event,
  hint: Sentry.EventHint
): Sentry.Event | null {
  // Scrub known PII from extra/contexts
  if (event.extra) {
    const safe: Record<string, unknown> = {};
    const blocklist = [
      "email",
      "password",
      "token",
      "firstName",
      "lastName",
      "username",
      "name",
    ];
    for (const [k, v] of Object.entries(event.extra)) {
      const lower = k.toLowerCase();
      if (blocklist.some((b) => lower.includes(b))) continue;
      safe[k] = v;
    }
    event.extra = safe;
  }
  return event;
}

export const initSentry = () => {
  if (!dsn) return;
  // Sentry init commented out (paid in production). Uncomment and set dsn above to re-enable.
  // const sampleRate = isProd ? 1.0 : 0.3;
  // Sentry.init({
  //   dsn,
  //   integrations: [browserTracingIntegration()],
  //   tracesSampleRate: 0.1,
  //   environment: process.env.NODE_ENV,
  //   replaysSessionSampleRate: 0,
  //   replaysOnErrorSampleRate: 0,
  //   beforeSend,
  //   sampleRate,
  // });
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

/** Report tool render failure. Sets tool name and optional safe profile for context. */
export function reportToolError(
  error: unknown,
  toolName: string,
  meta?: { profile?: SafeProfileContext }
) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("error_type", "tool_render");
    scope.setContext("tool", { tool_name: toolName, ...meta });
    Sentry.captureException(error);
  });
}

/** Report widget load failure (e.g. calendar, news embed). */
export function reportWidgetLoadError(
  error: unknown,
  widgetName: string,
  meta?: Record<string, unknown>
) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("error_type", "widget_load");
    scope.setContext("widget", { widget_name: widgetName, ...meta });
    Sentry.captureException(error);
  });
}

/** Report news fetch failure (API or provider). */
export function reportNewsFetchError(
  error: unknown,
  meta?: { source?: string; fromCache?: boolean }
) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("error_type", "news_fetch");
    scope.setContext("news", meta ?? {});
    Sentry.captureException(error);
  });
}
