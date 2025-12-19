// ErrorBoundary.js
import React from "react";

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, isChunkLoadError: false };

  static getDerivedStateFromError(error) {
    const message = String(error?.message || "");
    const name = String(error?.name || "");
    const isChunkLoadError =
      name === "ChunkLoadError" ||
      /ChunkLoadError/i.test(message) ||
      /Loading (CSS )?chunk \d+ failed/i.test(message) ||
      /Loading chunk \d+ failed/i.test(message);

    return { hasError: true, error, isChunkLoadError };
  }

  componentDidCatch(error, info) {
    console.error("Widget Error:", error, info);

    // Auto-recover from deploy/cache mismatch (hashed chunk file missing).
    // We do this only once per tab to avoid reload loops (e.g. flaky network).
    const message = String(error?.message || "");
    const name = String(error?.name || "");
    const isChunkLoadError =
      name === "ChunkLoadError" ||
      /ChunkLoadError/i.test(message) ||
      /Loading (CSS )?chunk \d+ failed/i.test(message) ||
      /Loading chunk \d+ failed/i.test(message);

    if (!isChunkLoadError) return;

    try {
      const key = "monevo_chunkload_recovered_v1";
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");

      // Clear Cache Storage (safe for CRA builds; does not clear auth tokens in localStorage).
      if (typeof window !== "undefined" && "caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => {});
      }

      // Reload with a cache-busting query (preserves hash routes).
      const href = window.location.href;
      const [basePart, hashPart] = href.split("#");
      const baseUrl = basePart.split("?")[0];
      const nextUrl = `${baseUrl}?v=${Date.now()}${
        hashPart ? `#${hashPart}` : ""
      }`;
      window.location.replace(nextUrl);
    } catch (e) {
      // Last resort: plain reload.
      try {
        window.location.reload();
      } catch (_) {
        // ignore
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-3xl border border-[color:var(--warning,#f59e0b)]/40 bg-[color:var(--warning,#f59e0b)]/10 px-4 py-4 text-sm text-[color:var(--warning,#b45309)] shadow-inner shadow-[color:var(--warning,#f59e0b)]/20">
          <p className="font-semibold">
            Something went wrong while loading this section.
          </p>
          <p className="mt-1 text-[color:var(--muted-text,#6b7280)]">
            {this.state.isChunkLoadError
              ? "A new version was deployed and your browser still has an older cached file. Reloading should fix it."
              : "Please refresh the page or try again later. If the problem persists, contact support."}
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--warning,#f59e0b)]/40 bg-[color:var(--warning,#f59e0b)]/15 px-4 py-2 text-xs font-semibold text-[color:var(--warning,#b45309)] transition hover:bg-[color:var(--warning,#f59e0b)]/25 focus:outline-none focus:ring-2 focus:ring-[color:var(--warning,#f59e0b)]/40"
            >
              Reload page
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
