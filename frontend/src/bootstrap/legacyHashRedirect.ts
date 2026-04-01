export const applyLegacyHashRedirect = () => {
  if (typeof window === "undefined") return;
  const href = String(window.location.href || "");
  const fragmentIndex = href.indexOf("#");
  const hasLegacyFragmentPath =
    fragmentIndex !== -1 &&
    href.length > fragmentIndex + 1 &&
    href[fragmentIndex + 1] === "/";

  if (!hasLegacyFragmentPath) return;
  const next = href.slice(fragmentIndex + 1);
  try {
    window.history.replaceState(null, document.title, next);
  } catch {
    window.location.replace(next);
  }
};
