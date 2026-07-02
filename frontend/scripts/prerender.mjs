import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const OUT = join(DIST, "__prerendered");
const PORT = 4173;

// Data-driven pages (lessons/guides) fetch their content from the backend at
// runtime. During prerender the SPA runs inside headless Chrome on
// http://localhost:PORT, so getBackendUrl() infers "http://localhost:8000/api"
// (or, with VITE_BACKEND_URL set, an absolute origin that CORS-blocks a
// localhost page). Either way the browser can't reach the API and every lesson
// renders "Lesson not found". We fix this by intercepting any /api/ request the
// page makes and fulfilling it server-side (node → backend), which has no CORS.
const PRERENDER_API_BASE = (
  process.env.PRERENDER_API_BASE ||
  process.env.VITE_BACKEND_URL ||
  "https://garzoni-production.up.railway.app/api"
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/, "")
  .concat("/api");

async function fulfillApiRequest(req) {
  // Re-target whatever origin the bundle used (localhost:8000, localhost:PORT,
  // or an absolute backend) onto PRERENDER_API_BASE, fetched from node.
  const reqUrl = new URL(req.url());
  const idx = reqUrl.pathname.indexOf("/api/");
  const rest =
    idx >= 0
      ? reqUrl.pathname.slice(idx + "/api/".length)
      : reqUrl.pathname.replace(/^\//, "");
  const target = `${PRERENDER_API_BASE}/${rest}${reqUrl.search}`;

  // The page origin (http://localhost:PORT) differs from the API URL's origin,
  // so the browser still enforces CORS on our fulfilled response and fires a
  // preflight. Echo permissive CORS headers and short-circuit OPTIONS, or the
  // XHR is blocked and the lesson renders "not found" despite a 200 body.
  const cors = {
    "access-control-allow-origin": req.headers().origin || "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers":
      req.headers()["access-control-request-headers"] ||
      "authorization,content-type",
  };
  if (req.method() === "OPTIONS") {
    return req.respond({ status: 204, headers: cors, body: "" });
  }
  try {
    const res = await fetch(target, {
      method: req.method(),
      headers: { accept: "application/json" },
    });
    const body = await res.text();
    await req.respond({
      status: res.status,
      headers: {
        ...cors,
        "content-type": res.headers.get("content-type") || "application/json",
      },
      body,
    });
  } catch (err) {
    console.error(`  ⚠ api proxy failed for ${target}: ${err.message}`);
    await req.respond({ status: 502, headers: cors, body: "{}" });
  }
}

const STATIC_ROUTES = [
  "/",
  "/about",
  "/learn",
  "/guides",
  "/marketing",
  "/subscriptions",
  "/privacy-policy",
  "/cookie-policy",
  "/terms-of-service",
  "/financial-disclaimer",
];

function serveDist() {
  const indexHtml = readFileSync(join(DIST, "index.html"), "utf-8");

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let filePath = join(DIST, url.pathname);

    if (existsSync(filePath) && !filePath.endsWith("/")) {
      const ext = filePath.split(".").pop();
      const mimeTypes = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        svg: "image/svg+xml",
        ico: "image/x-icon",
        woff2: "font/woff2",
        woff: "font/woff",
      };
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexHtml);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

// Markers that mean the page rendered an error/empty state instead of real
// content (e.g. the API 404'd mid-build). We must never bake these into a
// static snapshot — a "not found" page tells crawlers the URL is broken.
const ERROR_MARKERS = ["Guide not found", "Lesson not found"];

function isErrorSnapshot(html) {
  return ERROR_MARKERS.some((marker) => html.includes(marker));
}

function saveHtml(routePath, html) {
  const safePath = routePath === "/" ? "/index" : routePath;
  const outFile = join(OUT, `${safePath}.html`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, "utf-8");
  console.log(`  ✓ ${routePath} → ${outFile.replace(DIST, "dist")}`);
}

/**
 * Collapse duplicate SEO tags in the rendered <head>.
 *
 * The static index.html ships homepage-default SEO tags (title, canonical,
 * description, og:*, twitter:*) as a pre-hydration fallback. For meta/link,
 * react-helmet-async *appends* its own copies (marked data-rh="true") without
 * removing the static ones, so the snapshot ends up with two canonicals, two
 * descriptions, etc. — and a stale canonical pointing at the homepage would
 * de-index every lesson. This keeps helmet's managed copy and drops the static
 * duplicate, per semantic key. The <title> is a special case: helmet does not
 * reliably update it in the serialized snapshot, so we mirror og:title onto it
 * below (see note there).
 */
async function dedupeHead(page) {
  await page.evaluate(() => {
    const head = document.head;
    if (!head) return;

    const keyOf = (el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "title") return "title";
      if (tag === "meta") {
        const k = el.getAttribute("name") || el.getAttribute("property");
        return k ? `meta:${k.toLowerCase()}` : null;
      }
      if (tag === "link" && el.getAttribute("rel") === "canonical") {
        return "link:canonical";
      }
      return null;
    };

    const groups = new Map();
    for (const el of Array.from(head.children)) {
      const key = keyOf(el);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    }

    for (const els of groups.values()) {
      if (els.length < 2) continue;
      const managed = els.filter((e) => e.getAttribute("data-rh") === "true");
      // Prefer helmet's managed copy; otherwise keep the last one written.
      const keep = managed.length
        ? managed[managed.length - 1]
        : els[els.length - 1];
      for (const el of els) {
        if (el !== keep) el.remove();
      }
    }

    // react-helmet-async (this version) reliably applies its <meta> tags but
    // leaves the document <title> as the static index.html default in the
    // serialized snapshot. SeoHead always sets <title> and og:title from the
    // same value, so mirror the helmet-managed og:title back onto <title> to
    // give crawlers the page-specific title instead of the homepage default.
    const ogTitle = head
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content");
    const titleEl = head.querySelector("title");
    if (ogTitle && titleEl && titleEl.textContent !== ogTitle) {
      titleEl.textContent = ogTitle;
    }
  });
}

async function renderRoute(browser, route) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", async (req) => {
    try {
      if (/\/api\//.test(req.url())) {
        if (process.env.PRERENDER_DEBUG)
          console.error(`    [api] ${req.url()}`);
        await fulfillApiRequest(req);
      } else {
        await req.continue();
      }
    } catch {
      // Request may already be resolved or the page/target gone (during teardown).
      // Swallow — an unhandled rejection here destabilizes the browser connection.
    }
  });
  if (process.env.PRERENDER_DEBUG) {
    page.on("console", (msg) => console.error(`    [console] ${msg.text()}`));
    page.on("requestfailed", (req) =>
      console.error(`    [failed] ${req.url()} ${req.failure()?.errorText}`)
    );
  }
  try {
    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    await page.waitForSelector("#root", { timeout: 10_000 });
    // Wait for real content. Data-driven pages (lessons/guides) render a
    // "Loading…" state with no <h1> until their API call resolves, so a fixed
    // delay can snapshot the loading/not-found state during a slow or racy API.
    // Wait for a populated <h1> instead; fall back after the timeout for the
    // (few) routes that legitimately have no <h1>.
    try {
      await page.waitForFunction(
        () => {
          const h1 = document.querySelector("h1");
          return !!h1 && h1.textContent.trim().length > 0;
        },
        { timeout: 8000 }
      );
    } catch {
      // No <h1> appeared — proceed with whatever rendered.
    }
    // Small settle for any remaining hydration.
    await new Promise((r) => setTimeout(r, 500));
    await dedupeHead(page);
    return await page.content();
  } finally {
    await page.close();
  }
}

/**
 * Launch headless Chrome. On Vercel/CI (Amazon Linux build container) the system
 * is missing the shared libraries a normal Chrome needs (libnspr4.so etc.), so we
 * use @sparticuz/chromium which bundles a self-contained Chromium. Locally we use
 * the full `puppeteer` package and its managed Chrome download.
 */
async function launchBrowser() {
  const isServerless = !!(process.env.VERCEL || process.env.CI);

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;
    return puppeteerCore.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
}

async function fetchPublicLessonSlugs() {
  try {
    const apiBase =
      process.env.VITE_API_URL || "https://garzoni-production.up.railway.app";
    const res = await fetch(`${apiBase}/api/public/lessons/`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data.map((l) => l.slug);
    if (data.results) return data.results.map((l) => l.slug);
    return [];
  } catch {
    console.log(
      "  ⚠ Could not fetch public lesson slugs (API may not have list endpoint yet)"
    );
    return [];
  }
}

async function fetchPublishedArticleSlugs() {
  try {
    const apiBase =
      process.env.VITE_API_URL || "https://garzoni-production.up.railway.app";
    const res = await fetch(`${apiBase}/api/public/articles/`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data.map((a) => a.slug);
    if (data.results) return data.results.map((a) => a.slug);
    return [];
  } catch {
    console.log(
      "  ⚠ Could not fetch published article slugs (API may not have the endpoint yet)"
    );
    return [];
  }
}

/** Crude but dependency-free HTML → plain text for the LLM corpus. */
function htmlToText(html) {
  return (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|section|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Emit dist/llms-full.txt — a single plain-text corpus of every public lesson
 * and guide, for LLM ingestion (the route previously served the SPA shell,
 * which is garbage if crawled). Best-effort: never blocks the build.
 */
async function writeLlmsFull(lessonSlugs, articleSlugs) {
  const base = PRERENDER_API_BASE;
  const parts = [
    "# Garzoni — Full Content Corpus",
    "",
    "> Plain-text of all public Garzoni lessons and guides, for LLM ingestion.",
    "> Canonical pages: https://www.garzoni.app/learn/<slug> and /guides/<slug>.",
    "",
  ];
  for (const slug of lessonSlugs) {
    try {
      const res = await fetch(`${base}/public/lessons/${slug}/`);
      if (!res.ok) continue;
      const d = await res.json();
      const body = [
        d.detailed_content,
        ...(d.sections || []).map((s) => s.text_content),
      ]
        .map(htmlToText)
        .filter(Boolean)
        .join("\n\n");
      parts.push(
        `## Lesson: ${d.title}`,
        `URL: https://www.garzoni.app/learn/${d.slug}`,
        "",
        htmlToText(d.short_description),
        "",
        body,
        "",
        "---",
        ""
      );
    } catch {
      // skip this lesson
    }
  }
  for (const slug of articleSlugs) {
    try {
      const res = await fetch(`${base}/public/articles/${slug}/`);
      if (!res.ok) continue;
      const d = await res.json();
      parts.push(
        `## Guide: ${d.title}`,
        `URL: https://www.garzoni.app/guides/${d.slug}`,
        "",
        htmlToText(d.excerpt),
        "",
        htmlToText(d.content),
        "",
        "---",
        ""
      );
    } catch {
      // skip this guide
    }
  }
  writeFileSync(join(DIST, "llms-full.txt"), parts.join("\n"), "utf-8");
  console.log(
    `  ✓ llms-full.txt (${lessonSlugs.length} lessons + ${articleSlugs.length} guides)`
  );
}

async function main() {
  // Prerendered HTML is only ever served by the Vercel edge middleware on the
  // production deployment (bots → dist/__prerendered). Generating it on local,
  // CI, and Vercel preview builds just wastes time and makes every build fetch
  // the production API to enumerate lessons/articles. Run only on Vercel
  // production; allow PRERENDER=1 to force it locally for testing.
  const force = process.env.PRERENDER === "1";
  const isVercelProduction = process.env.VERCEL_ENV === "production";
  if (!force && !isVercelProduction) {
    console.log(
      "\n⏭  Skipping prerender (not a Vercel production build). " +
        "Set PRERENDER=1 to force locally.\n"
    );
    return;
  }

  console.log("\n🔨 Prerendering public pages for AI crawlers...\n");

  if (!existsSync(DIST)) {
    console.error("dist/ not found. Run vite build first.");
    process.exit(1);
  }

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    // A silent headless-browser failure previously shipped zero nested snapshots
    // without failing CI, 404'ing every lesson/guide to bots. On a production
    // build this must be fatal so a broken prerender never reaches Googlebot.
    console.error("✗ Could not launch a headless browser:", err.message);
    if (isVercelProduction) process.exit(1);
    console.error("  (non-production — skipping prerender)");
    return;
  }

  const server = await serveDist();

  const routes = [...STATIC_ROUTES];

  const lessonSlugs = await fetchPublicLessonSlugs();
  for (const slug of lessonSlugs) {
    routes.push(`/learn/${slug}`);
  }

  const articleSlugs = await fetchPublishedArticleSlugs();
  for (const slug of articleSlugs) {
    routes.push(`/guides/${slug}`);
  }

  // Empty slug lists on a production build mean the API was unreachable or
  // returned nothing — shipping only the ~10 static snapshots would leave the
  // entire content moat (43 lessons + 13 guides) 404ing to bots. Fail loudly.
  if (
    isVercelProduction &&
    (lessonSlugs.length === 0 || articleSlugs.length === 0)
  ) {
    console.error(
      `✗ Prerender aborted: lessons=${lessonSlugs.length}, articles=${articleSlugs.length}. ` +
        "Public content API returned no slugs on a production build."
    );
    await browser.close();
    server.close();
    process.exit(1);
  }

  console.log(`Rendering ${routes.length} routes...\n`);

  let skipped = 0;
  for (const route of routes) {
    try {
      let html = await renderRoute(browser, route);
      // A not-found render for a route we know exists (its slug came from the
      // published list/API) is a transient API hiccup mid-build. Retry a couple
      // of times before giving up so a blip never costs us the page.
      let attempt = 0;
      while (isErrorSnapshot(html) && attempt < 2) {
        attempt++;
        console.error(
          `  ↻ ${route}: error state, retry ${attempt}/2 after backoff…`
        );
        await new Promise((r) => setTimeout(r, 2500 * attempt));
        html = await renderRoute(browser, route);
      }
      if (isErrorSnapshot(html)) {
        // Still bad — don't overwrite a previously-good snapshot with an error
        // page; leave the old file (or none) so the next build self-corrects.
        console.error(
          `  ⚠ ${route}: still error after retries — skipping save`
        );
        skipped++;
        continue;
      }
      saveHtml(route, html);
    } catch (err) {
      console.error(`  ✗ ${route}: ${err.message}`);
    }
  }
  if (skipped > 0) {
    console.log(
      `\n⚠ Skipped ${skipped} route(s) that rendered an error state.`
    );
  }

  await browser.close();
  server.close();

  try {
    await writeLlmsFull(lessonSlugs, articleSlugs);
  } catch (err) {
    console.error("  ⚠ llms-full.txt generation failed:", err.message);
  }

  console.log(
    `\n✅ Prerendered ${routes.length} pages to dist/__prerendered/\n`
  );
}

main().catch((err) => {
  console.error("⚠ Prerender step failed:", err.message);
  // On production an unexpected failure must block the deploy — a build that
  // ships a stale/empty __prerendered tree 404's every lesson to crawlers.
  // On preview/local, fall back to the client-rendered shell and continue.
  if (process.env.VERCEL_ENV === "production") process.exit(1);
  process.exit(0);
});
