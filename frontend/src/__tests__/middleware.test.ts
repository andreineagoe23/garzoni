import { describe, expect, it } from "vitest";

import middleware from "../../middleware";

const SITE = "https://www.garzoni.app";
const HUMAN =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** Pathname the middleware rewrote to, or null when it let the request through. */
function rewrittenTo(path: string, ua: string): string | null {
  const res = middleware(
    new Request(`${SITE}${path}`, { headers: { "user-agent": ua } })
  );
  const target = res.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
}

describe("middleware snapshot routing", () => {
  it.each([
    ["/learn", "/__prerendered/learn.html"],
    [
      "/learn/how-compound-interest-works",
      "/__prerendered/learn/how-compound-interest-works.html",
    ],
    ["/guides", "/__prerendered/guides.html"],
    [
      "/guides/how-to-start-budgeting",
      "/__prerendered/guides/how-to-start-budgeting.html",
    ],
    ["/ro/learn", "/__prerendered/ro/learn.html"],
    [
      "/ro/learn/cash-flow-analysis",
      "/__prerendered/ro/learn/cash-flow-analysis.html",
    ],
    ["/ro/guides", "/__prerendered/ro/guides.html"],
    [
      "/ro/guides/what-is-garzoni",
      "/__prerendered/ro/guides/what-is-garzoni.html",
    ],
    ["/authors/andrei-neagoe", "/__prerendered/authors/andrei-neagoe.html"],
    ["/editorial-standards", "/__prerendered/editorial-standards.html"],
    ["/about", "/__prerendered/about.html"],
    [
      "/calculators/compound-interest",
      "/__prerendered/calculators/compound-interest.html",
    ],
    [
      "/ro/calculators/compound-interest",
      "/__prerendered/ro/calculators/compound-interest.html",
    ],
    ["/privacy-policy", "/__prerendered/privacy-policy.html"],
    ["/cookie-policy", "/__prerendered/cookie-policy.html"],
    ["/terms-of-service", "/__prerendered/terms-of-service.html"],
    ["/financial-disclaimer", "/__prerendered/financial-disclaimer.html"],
  ])("serves %s to visitors and crawlers as its snapshot", (path, snapshot) => {
    expect(rewrittenTo(path, HUMAN)).toBe(snapshot);
    expect(rewrittenTo(path, GOOGLEBOT)).toBe(snapshot);
  });

  it.each([
    "/",
    "/ro",
    "/login",
    "/register",
    "/onboarding",
    "/all-topics",
    "/tools",
    "/tools/budget",
    "/lessons/12/flow",
    "/courses/3",
    "/subscriptions",
    "/marketing",
    "/learn/x/y",
    "/learnings",
    "/aboutx",
  ])("leaves %s to the SPA for visitors", (path) => {
    expect(rewrittenTo(path, HUMAN)).toBeNull();
  });

  it("keeps crawlers on snapshots for every route", () => {
    expect(rewrittenTo("/", GOOGLEBOT)).toBe("/__prerendered/index.html");
    expect(rewrittenTo("/ro", GOOGLEBOT)).toBe("/__prerendered/ro.html");
    expect(rewrittenTo("/subscriptions", GOOGLEBOT)).toBe(
      "/__prerendered/subscriptions.html"
    );
    expect(rewrittenTo("/login", GOOGLEBOT)).toBe("/__prerendered/login.html");
  });

  it("sends a visitor flagged by 404.html to the SPA, but not a crawler", () => {
    expect(rewrittenTo("/learn/new-lesson?_spa=1", HUMAN)).toBeNull();
    expect(rewrittenTo("/learn/new-lesson?_spa=1", GOOGLEBOT)).toBe(
      "/__prerendered/learn/new-lesson.html"
    );
  });

  it("never rewrites assets or the API", () => {
    expect(rewrittenTo("/assets/index-abc.js", HUMAN)).toBeNull();
    expect(rewrittenTo("/api/public/lessons/", GOOGLEBOT)).toBeNull();
  });
});
