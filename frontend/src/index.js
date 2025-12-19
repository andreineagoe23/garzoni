import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import "styles/scss/main.scss";

const CHUNK_ERROR_KEY = "monevo-chunk-reloaded";

// Recover gracefully if the browser is holding onto an outdated bundle and a
// dynamically split chunk (JS or CSS) 404s. We attempt a single hard reload to
// pull the latest assets and avoid the persistent "ChunkLoadError" loop.
const handleChunkError = (errorEvent) => {
  const { error, message, target } = errorEvent || {};

  const isLinkTag = target?.tagName === "LINK";
  const source = target?.href || target?.src;
  const chunkLikeSource = typeof source === "string" && /chunk\.(css|js)/.test(source);

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
    (typeof reason?.message === "string" && reason.message.includes("ChunkLoadError"))
  ) {
    handleChunkError({ error: reason, message: reason?.message });
  }
});

// Clear the reload marker once the newest bundle is loaded successfully.
sessionStorage.removeItem(CHUNK_ERROR_KEY);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
