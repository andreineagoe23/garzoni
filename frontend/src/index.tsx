import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { registerServiceWorker } from "./serviceWorkerRegistration";
import "./styles/scss/main.scss";
import "./i18n";
import { initSentry } from "./sentry";
import { initAnalytics, trackAnalyticsEvent } from "./services/analyticsClient";

// Suppress third-party and generic script errors so they don't trigger the dev overlay
// or show in console. We register first so we can stop propagation.
type ReactErrorOverlayHook = {
  onError?: (error: unknown, info: unknown) => void;
  onUnhandledRejection?: (reason: unknown, promise: Promise<unknown>) => void;
  __monevo_patched?: boolean;
};

declare global {
  interface Window {
    __REACT_ERROR_OVERLAY_GLOBAL_HOOK__?: ReactErrorOverlayHook;
  }
}

if (typeof window !== "undefined") {
  const isThirdPartyOrScriptError = (
    message: string,
    source?: string,
    stack?: string
  ) => {
    const msg = (message || "").toLowerCase();
    const src = (source || "").toLowerCase();
    const stk = (stack || "").toLowerCase();
    if (msg === "script error." || msg === "script error") return true;
    const thirdPartyMessage =
      msg.includes("invalid environment") ||
      msg.includes("couldn't load support") ||
      msg.includes("support portal") ||
      msg.includes("dataproblemmodel") ||
      msg.includes("queryselector") ||
      /script error|resizeobserver|loading chunk failed/i.test(message);
    const thirdPartySource =
      src.includes("tradingview") ||
      src.includes("s3.tradingview") ||
      src.includes("snowplow") ||
      src.includes("embed-widget") ||
      src.includes("embed_events") ||
      src.includes("embed_timeline");
    const thirdPartyStack =
      stk.includes("tradingview") ||
      stk.includes("embed-widget") ||
      stk.includes("embed_events") ||
      stk.includes("embed_timeline") ||
      stk.includes("snowplow") ||
      stk.includes("support-portal") ||
      stk.includes("19052.") ||
      stk.includes("66224.");
    return thirdPartyMessage || thirdPartySource || thirdPartyStack;
  };
  const suppressScriptError = (event: ErrorEvent) => {
    if (
      isThirdPartyOrScriptError(
        event.message,
        event.filename,
        event.error?.stack
      )
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
    return false;
  };
  window.addEventListener("error", suppressScriptError, true);
  window.onerror = (message, source, _lineno, _colno, error) => {
    if (isThirdPartyOrScriptError(String(message), source, error?.stack))
      return true;
    return false;
  };
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event?.reason;
      const msg = reason?.message != null ? String(reason.message) : "";
      const stack = reason?.stack != null ? String(reason.stack) : "";
      if (isThirdPartyOrScriptError(msg, undefined, stack)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
  const patchOverlay = () => {
    const hook = window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__;
    if (!hook || hook.__monevo_patched) return;
    const isSuppressible = (value: unknown) => {
      const msg =
        typeof value === "string"
          ? value
          : String((value as any)?.message ?? "");
      const stack = (value as any)?.stack ?? "";
      return isThirdPartyOrScriptError(msg, undefined, stack);
    };
    const originalOnError = hook.onError;
    const originalOnRejection = hook.onUnhandledRejection;
    hook.onError = (error: unknown, info: unknown) => {
      if (isSuppressible(error)) return;
      return originalOnError?.(error, info);
    };
    hook.onUnhandledRejection = (
      reason: unknown,
      promise: Promise<unknown>
    ) => {
      if (isSuppressible(reason)) return;
      return originalOnRejection?.(reason, promise);
    };
    hook.__monevo_patched = true;
  };
  patchOverlay();
  const overlayInterval = window.setInterval(patchOverlay, 500);
  window.setTimeout(() => window.clearInterval(overlayInterval), 15000);
}

// Backwards-compat for legacy fragment-based URLs where the client route lives
// after the "#" fragment marker. This runs before React mounts so BrowserRouter
// sees the correct initial URL.
if (typeof window !== "undefined") {
  const href = String(window.location.href || "");
  const fragmentIndex = href.indexOf("#");
  const hasLegacyFragmentPath =
    fragmentIndex !== -1 &&
    href.length > fragmentIndex + 1 &&
    href[fragmentIndex + 1] === "/";

  if (hasLegacyFragmentPath) {
    const next = href.slice(fragmentIndex + 1); // "/path?query"
    try {
      window.history.replaceState(null, document.title, next);
    } catch (_) {
      // Fall back to a hard navigation if history APIs are blocked.
      window.location.replace(next);
    }
  }
}

const enableLogs = process.env.REACT_APP_ENABLE_LOGS === "true";

// Keep console clear: no-op when logs disabled; when enabled, filter third-party noise.
// Extension logs (Content Script Bridge) and "Failed to load resource" run outside our patch.
if (typeof window !== "undefined") {
  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  const originalDebug = console.debug.bind(console);

  if (!enableLogs) {
    (["log", "info", "warn", "error", "debug"] as Array<keyof Console>).forEach(
      (method) => {
        // eslint-disable-next-line no-console
        (console[method] as (..._args: unknown[]) => void) = () => undefined;
      }
    );
  } else {
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
      // Extension / protection tooling (TSS, CONTENT_SHELL, SCHJK, DFP, etc.)
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
      // Third-party embed noise (Investing.com streams, etc.)
      "heartbeat",
      "event-",
      "open-fx",
      "stream:",
      // Chrome DevTools violations and network noise
      "Violation",
      "non-passive",
      "Forced reflow",
      "handler took",
      "scroll-blocking",
      "event listener",
      "ERR_BLOCKED_BY_CLIENT",
      "Caught create URL",
      // TradingView embed noise (support portal 403, snowplow analytics)
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

    const shouldSuppress = function (): boolean {
      const arr = Array.prototype.slice.call(arguments);
      const full = arr
        .map((a: unknown) => {
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

    console.log = function () {
      if (shouldSuppress.apply(null, arguments as unknown as unknown[])) return;
      originalLog.apply(console, arguments as unknown as unknown[]);
    };

    console.info = function () {
      if (shouldSuppress.apply(null, arguments as unknown as unknown[])) return;
      originalInfo.apply(console, arguments as unknown as unknown[]);
    };

    console.warn = function () {
      if (shouldSuppress.apply(null, arguments as unknown as unknown[])) return;
      originalWarn.apply(console, arguments as unknown as unknown[]);
    };

    console.error = function () {
      if (shouldSuppress.apply(null, arguments as unknown as unknown[])) return;
      originalError.apply(console, arguments as unknown as unknown[]);
    };

    console.debug = function () {
      if (shouldSuppress.apply(null, arguments as unknown as unknown[])) return;
      originalDebug.apply(console, arguments as unknown as unknown[]);
    };
  }
}

initSentry();
initAnalytics();

const CHUNK_ERROR_KEY = "monevo-chunk-reloaded";

// Recover gracefully if the browser is holding onto an outdated bundle and a
// dynamically split chunk (JS or CSS) 404s. We attempt a single hard reload to
// pull the latest assets and avoid the persistent "ChunkLoadError" loop.
const handleChunkError = (errorEvent) => {
  const { error, message, target } = errorEvent || {};

  const isLinkTag = target?.tagName === "LINK";
  const source = target?.href || target?.src;
  const chunkLikeSource =
    typeof source === "string" && /chunk\.(css|js)/.test(source);

  const isChunkError =
    error?.name === "ChunkLoadError" ||
    (typeof message === "string" && message.includes("ChunkLoadError")) ||
    (typeof message === "string" && message.includes("Loading CSS chunk")) ||
    (isLinkTag && chunkLikeSource);

  if (!isChunkError) return;

  const hasReloaded = sessionStorage.getItem(CHUNK_ERROR_KEY);

  if (hasReloaded) {
    // Prevent an infinite reload loop if the asset is genuinely missing.
    sessionStorage.removeItem(CHUNK_ERROR_KEY);
    return;
  }

  const triggerReload = () => {
    sessionStorage.setItem(CHUNK_ERROR_KEY, "true");
    window.location.reload();
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const handleOnlineOnce = () => {
      window.removeEventListener("online", handleOnlineOnce);
      triggerReload();
    };

    window.addEventListener("online", handleOnlineOnce);
    return;
  }

  triggerReload();
};

window.addEventListener("error", handleChunkError);
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  if (
    reason?.name === "ChunkLoadError" ||
    (typeof reason?.message === "string" &&
      reason.message.includes("ChunkLoadError"))
  ) {
    handleChunkError({ error: reason, message: reason?.message });
  }
});

// Clear the reload marker once the newest bundle is loaded successfully.
sessionStorage.removeItem(CHUNK_ERROR_KEY);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals((metric) => {
  trackAnalyticsEvent("web_vital", {
    name: metric.name,
    value: metric.value,
    id: metric.id,
  });
});
registerServiceWorker();
