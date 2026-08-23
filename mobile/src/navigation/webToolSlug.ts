/**
 * Incoming tool slug -> the route the *web* app actually serves.
 *
 * `app/tools/[tool].tsx` loads `${webBase}/tools/<slug>` in a WebView, so the
 * slug has to be a web route. Two entries never were: `savings-goals` is the
 * mobile id but web calls it `savings-calculator`, and `economic-calendar` is
 * a route on neither platform — the calendar is `calendar` on both. Both
 * produced a 404 inside the WebView, and the real `calendar` slug was rejected
 * outright by the allowlist that preceded this map.
 *
 * Mostly latent: every tool here except the calendar has a native screen, and
 * Expo Router matches static routes before the dynamic one. It stops being
 * latent for push deep links, where a campaign written with a web slug arrives
 * with no native route to catch it first.
 *
 * Keys are what we accept — mobile ids and legacy spellings, so links already
 * sent keep resolving. Values are what the web serves.
 */
const WEB_TOOL_SLUG: Record<string, string> = {
  "budget-planner": "budget-planner",
  "personal-cfo": "personal-cfo",
  "reality-check": "reality-check",
  "economic-map": "economic-map",
  "news-context": "news-context",
  "market-explorer": "market-explorer",
  "savings-goals": "savings-calculator",
  "savings-calculator": "savings-calculator",
  calendar: "calendar",
  "economic-calendar": "calendar",
};

/**
 * The web route for a slug, or null when we do not recognise it. Null is the
 * signal to show the "not available in this build" state rather than open a
 * WebView at a URL that will 404.
 */
export function resolveWebToolSlug(slug: string | undefined): string | null {
  const trimmed = (slug ?? "").trim();
  if (!trimmed) return null;
  return WEB_TOOL_SLUG[trimmed] ?? null;
}

/** Every slug this screen accepts. Exported for tests and tooling. */
export function acceptedToolSlugs(): string[] {
  return Object.keys(WEB_TOOL_SLUG);
}
