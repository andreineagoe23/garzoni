/**
 * Logs API / tool failures in development so Metro shows the real cause
 * (many screens use `catch {}` and only show generic UI copy).
 */
export function logDevError(scope: string, err: unknown): void {
  if (!__DEV__) return;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  let extra = "";
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response?: { status?: number; data?: unknown } })
      .response;
    if (r) {
      const body =
        typeof r.data === "string"
          ? r.data.slice(0, 800)
          : JSON.stringify(r.data)?.slice(0, 800);
      extra = ` status=${r.status ?? "?"} body=${body ?? ""}`;
    }
  }
  console.error(`[Garzoni][${scope}]`, message || err, extra || "");
}
