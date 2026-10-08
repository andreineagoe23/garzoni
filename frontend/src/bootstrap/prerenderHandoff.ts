/**
 * Hand a prerendered snapshot (dist/__prerendered, see scripts/prerender.mjs)
 * over to the app without a flash.
 *
 * `createRoot` would wipe the snapshot on its first commit and show the auth and
 * Suspense loading states before the page re-renders. Instead the snapshot moves
 * out of #root into a sibling that stays on screen, the app renders into a
 * hidden #root, and the two swap once the app shows the page's own <h1> with no
 * loading fallback left — the same signal the prerender waits for.
 *
 * A snapshot that index.html's head script marked stale (rendered in the
 * visitor's other UI language, kept hidden) is dropped, and the app loads as it
 * does without one.
 */
const MAX_WAIT_MS = 8000;

const HIDDEN_ROOT_STYLE =
  "position:absolute;top:0;left:0;width:100%;visibility:hidden;pointer-events:none";

export function handOffPrerenderedSnapshot(root: HTMLElement): void {
  const html = document.documentElement;
  if (!html.hasAttribute("data-prerendered")) return;
  html.removeAttribute("data-prerendered");

  if (html.getAttribute("data-snapshot") === "stale" || !root.hasChildNodes()) {
    root.replaceChildren();
    html.removeAttribute("data-snapshot");
    return;
  }

  const snapshot = document.createElement("div");
  snapshot.append(...Array.from(root.childNodes));
  // After #root, so getElementById finds the app's element, not the snapshot's.
  root.after(snapshot);
  root.style.cssText = HIDDEN_ROOT_STYLE;

  const isReady = () =>
    !root.querySelector("[data-app-fallback]") &&
    Array.from(root.querySelectorAll("h1")).some((h1) =>
      h1.textContent?.trim()
    );

  let timer = 0;
  const observer = new MutationObserver(() => {
    if (isReady()) reveal();
  });

  function reveal() {
    observer.disconnect();
    window.clearTimeout(timer);
    snapshot.remove();
    root.removeAttribute("style");
  }

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  timer = window.setTimeout(reveal, MAX_WAIT_MS);
}

/**
 * public/404.html sends a visitor back with `?_spa=1` when their lesson or guide
 * has no snapshot yet (see middleware.ts). Drop the flag before the router and
 * analytics read the URL.
 */
export function dropSpaFallbackParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("_spa")) return;
  url.searchParams.delete("_spa");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}
