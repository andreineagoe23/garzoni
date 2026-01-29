import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { registerServiceWorker } from "./serviceWorkerRegistration";
import "./styles/scss/main.scss";
import { initSentry } from "./sentry";
import { initAnalytics, trackAnalyticsEvent } from "./services/analyticsClient";

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
if (!enableLogs) {
  ["log", "info", "warn", "error"].forEach((method) => {
    // eslint-disable-next-line no-console
    console[method] = () => undefined;
  });
}

// Suppress browser extension and PWA warnings
if (typeof window !== "undefined") {
  // Suppress Chrome extension runtime.lastError warnings and PWA install prompt warnings
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = function (...args) {
    const message = args[0]?.toString() || "";
    if (
      message.includes("runtime.lastError") ||
      message.includes("message port closed") ||
      message.includes("beforeinstallprompt")
    ) {
      return; // Suppress these specific warnings
    }
    originalError.apply(console, args);
  };

  console.warn = function (...args) {
    const message = args[0]?.toString() || "";
    if (
      message.includes("runtime.lastError") ||
      message.includes("message port closed") ||
      message.includes("Banner not shown") ||
      message.includes("beforeinstallprompt")
    ) {
      return; // Suppress these specific warnings
    }
    originalWarn.apply(console, args);
  };
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
