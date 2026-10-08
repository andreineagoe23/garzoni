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

/** Same keys as the prerender's dedupeHead, plus hreflang alternates. */
function headKey(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  if (tag === "title") return "title";
  if (tag === "meta") {
    const name = el.getAttribute("name") || el.getAttribute("property");
    return name ? `meta:${name.toLowerCase()}` : null;
  }
  if (tag === "link") {
    const rel = el.getAttribute("rel");
    if (rel === "canonical") return "canonical";
    if (rel === "alternate" && el.hasAttribute("hreflang")) {
      return `alternate:${el.getAttribute("hreflang")}`;
    }
  }
  return null;
}

/**
 * The snapshot's <title>, canonical and meta tags are plain elements React does
 * not own, so the app's own copies land next to them — and the browser keeps
 * showing the first <title> even after client-side navigation. Drop each
 * snapshot tag as soon as the app writes its replacement.
 */
function retireSnapshotHeadTags(): void {
  const stale = new Map<string, Element[]>();
  for (const el of Array.from(document.head.children)) {
    const key = headKey(el);
    if (key) stale.set(key, [...(stale.get(key) ?? []), el]);
  }
  if (stale.size === 0) return;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        const key = node instanceof Element ? headKey(node) : null;
        const old = key ? stale.get(key) : undefined;
        if (!key || !old) continue;
        old.forEach((el) => el.remove());
        stale.delete(key);
      }
    }
    if (stale.size === 0) observer.disconnect();
  });
  observer.observe(document.head, { childList: true });
}

export function handOffPrerenderedSnapshot(root: HTMLElement): void {
  const html = document.documentElement;
  if (!html.hasAttribute("data-prerendered")) return;
  html.removeAttribute("data-prerendered");
  retireSnapshotHeadTags();

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
