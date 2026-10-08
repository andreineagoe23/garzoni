import { describe, expect, it } from "vitest";
import { shareImageUrl } from "./publicLocale";
import {
  applyShareImage,
  shareCardKind,
  shareCardUrl,
  uncoveredChars,
} from "../../../scripts/og-card.mjs";

describe("share card URLs", () => {
  it("match between the page (SeoHead) and the prerender that writes them", () => {
    for (const route of [
      "/learn/good-debt-vs-bad-debt",
      "/ro/guides/how-to-pay-off-debt",
      "/calculators/compound-interest",
      "/authors/andrei-neagoe",
    ]) {
      expect(shareImageUrl(route)).toBe(shareCardUrl(route));
    }
    expect(shareImageUrl("/ro/learn/x")).toBe(
      "https://www.garzoni.app/og/ro/learn/x.jpg"
    );
  });

  it("are drawn only for lessons, guides, calculators and authors", () => {
    expect(shareCardKind("/learn/x")).toBe("lesson");
    expect(shareCardKind("/ro/learn/x")).toBe("lesson");
    expect(shareCardKind("/ro/guides/x")).toBe("guide");
    expect(shareCardKind("/calculators/compound-interest")).toBe("calculator");
    expect(shareCardKind("/authors/andrei-neagoe")).toBe("author");
    expect(shareCardKind("/learn")).toBeNull();
    expect(shareCardKind("/ro/guides")).toBeNull();
    expect(shareCardKind("/about")).toBeNull();
  });
});

describe("applyShareImage", () => {
  const route = "/guides/x";
  const card = "https://www.garzoni.app/og/guides/x.jpg";
  const snapshot =
    "<html><head>" +
    `<meta property="og:image" content="${card}" data-rh="true">` +
    `<meta name="twitter:image" content="${card}" data-rh="true">` +
    '<meta property="og:image:width" content="1200">' +
    `<script type="application/ld+json">{"image":"${card}"}</script>` +
    "</head><body></body></html>";

  it("points the tags at the card and adds alt text", () => {
    const html = applyShareImage(snapshot, route, 'Guide: "Budgeting" & you');
    expect(html).toContain(`<meta property="og:image" content="${card}"`);
    expect(html).toContain(`<meta name="twitter:image" content="${card}"`);
    expect(html).toContain('content="Guide: &quot;Budgeting&quot; &amp; you"');
    expect(html.match(/og:image:width/g)).toHaveLength(1);
    expect(html).toContain('property="og:image:height" content="630"');
  });

  it("falls back to the site-wide image everywhere when no card was written", () => {
    const html = applyShareImage(snapshot, route, null);
    expect(html).not.toContain(card);
    expect(html).toContain(
      '<meta property="og:image" content="https://www.garzoni.app/og-image.jpg"'
    );
    expect(html).toContain('"image":"https://www.garzoni.app/og-image.jpg"');
    expect(html).not.toContain("og:image:alt");
  });
});

describe("uncoveredChars", () => {
  it("reports characters the embedded fonts cannot draw", () => {
    const latin: Array<[number, number]> = [
      [0x0000, 0x00ff],
      [0x0218, 0x021b],
    ];
    expect(uncoveredChars("Datorii și ță", latin)).toEqual(["ă"]);
    expect(uncoveredChars("Save 🚀", latin)).toEqual(["🚀"]);
  });
});
