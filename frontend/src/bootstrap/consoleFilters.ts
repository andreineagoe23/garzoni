export const initConsoleFilters = (enableLogs: boolean) => {
  if (typeof window === "undefined") return;

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalDebug = console.debug.bind(console);

  if (!enableLogs) {
    (["log", "info", "warn", "error", "debug"] as Array<keyof Console>).forEach(
      (method) => {
        (console[method] as (..._args: unknown[]) => void) = () => undefined;
      }
    );
    return;
  }

  const suppressedPhrases = [
    "runtime.lastError",
    "message port closed",
    "Content Script Bridge",
    "Sending response back to page context",
    "React DevTools",
    "Download the React DevTools",
    "react refresh",
    "unsupported",
    "uses an unsupported",
    "preload",
    "rel=preload",
    "TSS:",
    "CONTENT_SHELL",
    "Page is excluded",
    "Skipping shell protection",
    "Shell protection",
    "SCHJK",
    "Search Hijacking",
    "DFP",
    "Breach notification",
    "feature flag is enabled",
    "Unknown message type",
    "MSG_CHECK_DOMAIN_ALLOW_LIST_RESPONSE",
    "injection-tss",
    "hosted page injected",
    "MBTSS",
    "webpackOk",
    "Counted history",
    "Caught history",
    "Checking if repeated",
    "excluded result",
    "Risky TLD",
    "aggressive protection",
    "MBTSS_NOTIFICATION",
    "heartbeat",
    "event-",
    "open-fx",
    "stream:",
    "Violation",
    "non-passive",
    "Forced reflow",
    "handler took",
    "scroll-blocking",
    "event listener",
    "ERR_BLOCKED_BY_CLIENT",
    "Caught create URL",
    "Invalid environment undefined",
    "Invalid environment",
    "support-portal-problems",
    "support portal problems",
    "Couldn't load support portal",
    "Couldn't load support",
    "Chart.DataProblemModel",
    "DataProblemModel",
    "Status 403",
    "snowplow-embed-widget",
    "Fetch:",
    "19052.",
    "66224.",
    "tradingview-widget.com/support",
    "_requestSupportPortalProblems",
    "runtime-embed_events",
    "runtime-embed_timeline",
    "embed_events_widget",
    "embed_timeline_widget",
    "embed_advanced_chart",
  ];

  const shouldSuppress = (...args: unknown[]) => {
    const full = args
      .map((a) => {
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");
    return suppressedPhrases.some((phrase) => full.includes(phrase));
  };

  console.log = (...args: unknown[]) => {
    if (shouldSuppress(...args)) return;
    originalLog(...args);
  };
  console.info = (...args: unknown[]) => {
    if (shouldSuppress(...args)) return;
    originalInfo(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (shouldSuppress(...args)) return;
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (shouldSuppress(...args)) return;
    originalError(...args);
  };
  console.debug = (...args: unknown[]) => {
    if (shouldSuppress(...args)) return;
    originalDebug(...args);
  };
};
