import { acceptedToolSlugs, resolveWebToolSlug } from "../webToolSlug";

/**
 * The WebView fallback builds `${webBase}/tools/<slug>`, so every value here
 * has to be a route the *web* app serves. These are the routes it registers
 * (frontend/src/components/tools/toolsRegistry.ts).
 */
const WEB_ROUTES = new Set([
  "personal-cfo",
  "budget-planner",
  "statement-import",
  "savings-calculator",
  "portfolio",
  "reality-check",
  "calendar",
  "economic-map",
  "news-context",
  "market-explorer",
  "next-steps",
]);

describe("resolveWebToolSlug", () => {
  it("never resolves to a slug the web app does not serve", () => {
    // The bug this replaces: `savings-goals` and `economic-calendar` were both
    // allowed through and both 404'd inside the WebView.
    for (const slug of acceptedToolSlugs()) {
      const resolved = resolveWebToolSlug(slug);
      expect(resolved).not.toBeNull();
      expect(WEB_ROUTES.has(resolved as string)).toBe(true);
    }
  });

  it("maps the mobile savings id to the web route", () => {
    expect(resolveWebToolSlug("savings-goals")).toBe("savings-calculator");
  });

  it("accepts the web savings slug too, for push links written against web", () => {
    expect(resolveWebToolSlug("savings-calculator")).toBe("savings-calculator");
  });

  it("resolves the real calendar route, which the old allowlist rejected", () => {
    expect(resolveWebToolSlug("calendar")).toBe("calendar");
  });

  it("still honours the legacy economic-calendar spelling", () => {
    expect(resolveWebToolSlug("economic-calendar")).toBe("calendar");
  });

  it("returns null for an unknown slug rather than opening a 404", () => {
    expect(resolveWebToolSlug("not-a-tool")).toBeNull();
  });

  it("returns null for empty, whitespace and undefined input", () => {
    expect(resolveWebToolSlug("")).toBeNull();
    expect(resolveWebToolSlug("   ")).toBeNull();
    expect(resolveWebToolSlug(undefined)).toBeNull();
  });

  it("trims surrounding whitespace from a slug", () => {
    expect(resolveWebToolSlug("  calendar  ")).toBe("calendar");
  });
});
