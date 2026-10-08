import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

/**
 * Per-page Open Graph share cards (1200×630), rendered by prerender.mjs.
 *
 * A public page opts in by pointing its og:image at shareCardUrl(route) — the
 * pages build that URL with shareImageUrl() in src/components/seo/publicLocale.ts,
 * which must stay in step with shareCardUrl() here. The prerender then draws the
 * card into dist/og/<route>.jpg and makes the snapshot's og:image/twitter:image
 * tags agree with what was actually written.
 *
 * Everything the card uses is something the site already ships: brand colours
 * from src/styles/brand.css, Inter + JetBrains Mono from @fontsource (embedded
 * as data URIs, so the render never touches the network), the white wordmark
 * from brand/logo-dark.png and the kickers from the shared locales.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const REPO = join(__dirname, "..", "..");

export const SITE = "https://www.garzoni.app";
export const DEFAULT_SHARE_IMAGE = `${SITE}/og-image.jpg`;
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const JPEG_QUALITY = 86;

const KIND_BY_SECTION = {
  learn: "lesson",
  guides: "guide",
  calculators: "calculator",
  authors: "author",
};

/** "/ro/learn/x" → "lesson"; null for routes that keep the site-wide image. */
export function shareCardKind(route) {
  const parts = route.split("/").filter(Boolean);
  if (parts[0] === "ro") parts.shift();
  if (parts.length !== 2) return null;
  return KIND_BY_SECTION[parts[0]] ?? null;
}

export const shareCardLang = (route) =>
  route === "/ro" || route.startsWith("/ro/") ? "ro" : "en";

export const shareCardFile = (route) => `og${route}.jpg`;

export const shareCardUrl = (route) => `${SITE}/${shareCardFile(route)}`;

export function loadKickers() {
  const read = (lang) =>
    JSON.parse(
      readFileSync(
        join(REPO, "packages/core/src/locales", lang, "common.json"),
        "utf-8"
      )
    ).shareImage.kicker;
  return { en: read("en"), ro: read("ro") };
}

/** Alt text — the same string SeoHead gets from the page on the client. */
export const shareCardAlt = (kicker, title) => `${kicker}: ${title}`;

/**
 * The latin + latin-ext @font-face rules of one @fontsource stylesheet, with the
 * woff2 inlined. latin-ext carries the Romanian ș/ț/ă/î/â.
 */
function inlineFontFaces(cssModule) {
  const cssPath = require.resolve(cssModule);
  const css = readFileSync(cssPath, "utf-8");
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  const kept = [];
  const ranges = [];
  for (const face of faces) {
    const woff2 = face.match(
      /url\(\.\/files\/([^)]+-latin(?:-ext)?-[^)]+\.woff2)\)/
    );
    if (!woff2) continue;
    const file = join(dirname(cssPath), "files", woff2[1]);
    const data = readFileSync(file).toString("base64");
    kept.push(
      face.replace(
        /src:[^;]+;/,
        `src: url(data:font/woff2;base64,${data}) format('woff2');`
      )
    );
    const range = face.match(/unicode-range:([^;]+);/);
    if (range) ranges.push(...parseUnicodeRange(range[1]));
  }
  if (kept.length === 0) throw new Error(`no latin faces in ${cssModule}`);
  return { css: kept.join("\n"), ranges };
}

function parseUnicodeRange(value) {
  return value.split(",").map((part) => {
    const [from, to] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(from, 16), parseInt(to ?? from, 16)];
  });
}

const TEMPLATE_BODY = `
  <div class="card">
    <div class="logo" role="img" aria-label="Garzoni"></div>
    <div class="body">
      <div class="stack">
        <p class="kicker"></p>
        <h1 class="title"></h1>
      </div>
    </div>
    <p class="foot">www.garzoni.app</p>
  </div>`;

const TEMPLATE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; overflow: hidden; }
  body {
    font-family: var(--brand-font-primary);
    color: var(--brand-text);
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(840px circle at 6% 0%, rgba(var(--brand-green-rgb), 0.6), transparent 70%),
      radial-gradient(720px circle at 100% 8%, rgba(var(--brand-gold-warm-rgb), 0.12), transparent 70%),
      radial-gradient(1080px circle at 50% 130%, rgba(var(--brand-green-rgb), 0.3), transparent 70%),
      linear-gradient(180deg, var(--brand-bg-dark) 0%, var(--brand-bg-card) 55%, var(--brand-bg-dark) 100%);
  }
  .card {
    position: absolute;
    inset: 0;
    padding: 56px 80px 52px;
    display: flex;
    flex-direction: column;
  }
  /* Same crop of logo-dark.png as the Play feature graphic (store-assets). */
  .logo {
    flex: none;
    width: 236px;
    aspect-ratio: 1090 / 320;
    background: var(--logo) no-repeat;
    background-size: 110.09% auto;
    background-position: 54.5% 47.16%;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 18px;
    font-family: var(--brand-font-mono);
    font-weight: 400;
    font-size: 26px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand-gold-warm);
  }
  .kicker::before {
    content: "";
    width: 44px;
    height: 4px;
    border-radius: 2px;
    background: var(--brand-gold-warm);
  }
  .title {
    margin-top: 22px;
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.03em;
    text-wrap: balance;
    overflow-wrap: break-word;
  }
  .foot {
    flex: none;
    font-weight: 600;
    font-size: 24px;
    letter-spacing: 0.01em;
    color: var(--brand-text-muted);
  }`;

/**
 * The self-contained card page plus a version hash. Any change to the template,
 * fonts, logo or brand colours changes the version and so invalidates every
 * cached card.
 */
export function buildCardTemplate() {
  const brandCss = readFileSync(
    join(REPO, "frontend/src/styles/brand.css"),
    "utf-8"
  );
  const inter = inlineFontFaces("@fontsource/inter/800.css");
  const mono = inlineFontFaces("@fontsource/jetbrains-mono/400.css");
  const logo = readFileSync(join(REPO, "brand/logo-dark.png")).toString(
    "base64"
  );
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
${brandCss}
${inter.css}
${mono.css}
:root { --logo: url(data:image/png;base64,${logo}); }
${TEMPLATE_CSS}
</style>
</head>
<body>${TEMPLATE_BODY}</body>
</html>`;
  return {
    html,
    version: createHash("sha1").update(html).digest("hex").slice(0, 16),
    titleRanges: inter.ranges,
    kickerRanges: mono.ranges,
  };
}

/**
 * Characters the embedded fonts cannot draw. The serverless Chromium on Vercel
 * has next to no system fonts, so anything outside these ranges would render as
 * a box — such a page keeps the site-wide image instead.
 */
export function uncoveredChars(text, ranges) {
  const missing = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (/\s/.test(ch)) continue;
    if (!ranges.some(([from, to]) => cp >= from && cp <= to)) missing.add(ch);
  }
  return [...missing];
}

/** Lay out one card in the page; shrinks the title until it fits. */
async function layoutCard({ kicker, title, lang }) {
  document.documentElement.lang = lang;
  const kickerEl = document.querySelector(".kicker");
  const titleEl = document.querySelector(".title");
  const body = document.querySelector(".body");
  const stack = document.querySelector(".stack");
  kickerEl.textContent = kicker;
  titleEl.textContent = title;
  await document.fonts.ready;

  const faces = [...document.fonts];
  const loaded = (family) =>
    faces.some((f) => f.family.includes(family) && f.status === "loaded");
  if (!loaded("Inter") || !loaded("JetBrains Mono")) {
    return { ok: false, reason: "brand fonts did not load" };
  }

  // Largest size that fits in three lines; only a title that cannot fit in
  // three at the floor size gets a fourth line.
  for (const maxLines of [3, 4]) {
    for (let size = 76; size >= 44; size -= 2) {
      titleEl.style.fontSize = `${size}px`;
      const lineHeight = parseFloat(getComputedStyle(titleEl).lineHeight);
      const lines = Math.round(titleEl.offsetHeight / lineHeight);
      const fits =
        stack.offsetHeight <= body.clientHeight &&
        titleEl.scrollWidth <= titleEl.clientWidth + 1 &&
        kickerEl.scrollWidth <= kickerEl.clientWidth + 1 &&
        lines <= maxLines;
      if (!fits) continue;
      if (!document.fonts.check(`800 ${size}px Inter`, title)) {
        return { ok: false, reason: "Inter cannot draw the title" };
      }
      return { ok: true, size, lines };
    }
  }
  return { ok: false, reason: "title does not fit at the smallest size" };
}

/**
 * A reusable Chrome page with the template loaded once; render() only swaps the
 * text, so each card costs a layout and a screenshot.
 */
export async function createCardRenderer(browser, template) {
  const page = await browser.newPage();
  await page.setViewport({
    width: OG_WIDTH,
    height: OG_HEIGHT,
    deviceScaleFactor: 1,
  });
  await page.setContent(template.html, { waitUntil: "load" });
  await page.evaluate(() =>
    Promise.all([...document.fonts].map((face) => face.load()))
  );
  return {
    async render(card) {
      const result = await page.evaluate(layoutCard, card);
      if (!result.ok) throw new Error(result.reason);
      return page.screenshot({
        type: "jpeg",
        quality: JPEG_QUALITY,
        clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
      });
    },
    close: () => page.close(),
  };
}

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

/** Set (or add) one <meta> in a serialized snapshot; null removes it. */
function setMeta(html, attr, key, value) {
  const pattern = new RegExp(
    `<meta\\b[^>]*\\b(?:name|property)="${key.replace(/[.:]/g, "\\$&")}"[^>]*>`,
    "gi"
  );
  const stripped = html.replace(pattern, "");
  if (value == null) return stripped;
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(value)}" data-rh="true">`;
  return stripped.replace("</head>", `${tag}</head>`);
}

/**
 * Make a snapshot's share-image tags match what the build produced. With a card
 * the tags point at it; without one (render failed) every reference to the
 * card URL — og/twitter tags and Article JSON-LD alike — falls back to the
 * site-wide image, so a crawler is never sent to a file that does not exist.
 */
export function applyShareImage(html, route, alt) {
  const cardUrl = shareCardUrl(route);
  let out = html;
  if (alt == null) {
    out = out.split(cardUrl).join(DEFAULT_SHARE_IMAGE);
    out = setMeta(out, "property", "og:image:alt", null);
    out = setMeta(out, "name", "twitter:image:alt", null);
  } else {
    out = setMeta(out, "property", "og:image", cardUrl);
    out = setMeta(out, "name", "twitter:image", cardUrl);
    out = setMeta(out, "property", "og:image:alt", alt);
    out = setMeta(out, "name", "twitter:image:alt", alt);
  }
  out = setMeta(out, "property", "og:image:width", String(OG_WIDTH));
  out = setMeta(out, "property", "og:image:height", String(OG_HEIGHT));
  return out;
}
