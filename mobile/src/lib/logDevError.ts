import * as Sentry from "@sentry/react-native";

function extractApiMeta(err: unknown): {
  message: string;
  extra: string;
  requestId?: string;
} {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  let extra = "";
  let requestId: string | undefined;

  if (err && typeof err === "object" && "response" in err) {
    const response = (
      err as {
        response?: {
          status?: number;
          data?: unknown;
          headers?: Record<string, string | string[] | undefined>;
        };
      }
    ).response;
    if (response) {
      const body =
        typeof response.data === "string"
          ? response.data.slice(0, 800)
          : JSON.stringify(response.data)?.slice(0, 800);
      extra = ` status=${response.status ?? "?"} body=${body ?? ""}`;
      const header =
        response.headers?.["x-request-id"] ??
        response.headers?.["X-Request-ID"];
      requestId = Array.isArray(header) ? header[0] : header;
    }
  }

  return { message, extra, requestId };
}

/**
 * Logs API / tool failures in development and reports them to Sentry in production.
 */
export function logDevError(scope: string, err: unknown): void {
  const { message, extra, requestId } = extractApiMeta(err);

  if (__DEV__) {
    console.error(`[Garzoni][${scope}]`, message || err, extra || "");
    return;
  }

  Sentry.withScope((sentryScope) => {
    sentryScope.setTag("scope", scope);
    if (requestId) sentryScope.setTag("request_id", requestId);
    sentryScope.setContext("api_error", {
      scope,
      message: message || String(err),
      request_id: requestId,
      details: extra || undefined,
    });
    if (err instanceof Error) {
      Sentry.captureException(err);
      return;
    }
    Sentry.captureMessage(
      `[Garzoni][${scope}] ${message || String(err)}`,
      "error",
    );
  });
}
