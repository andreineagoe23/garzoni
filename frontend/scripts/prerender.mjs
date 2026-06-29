import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const OUT = join(DIST, "__prerendered");
const PORT = 4173;

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
 * description, og:*, twitter:*) as a pre-hydration fallback. react-helmet-async
 * sets the page-specific title via document.title (mutating the existing tag) but
 * for meta/link it *appends* its own copies (marked data-rh="true") without
 * removing the static ones. The snapshot therefore ends up with two canonicals,
 * two descriptions, etc. — and a stale canonical pointing at the homepage will
 * de-index every lesson. This keeps helmet's managed copy and drops the static
 * duplicate, per semantic key.
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
  });
}

async function renderRoute(browser, route) {
  const page = await browser.newPage();
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
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
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

async function main() {
  console.log("\n🔨 Prerendering public pages for AI crawlers...\n");

  if (!existsSync(DIST)) {
    console.error("dist/ not found. Run vite build first.");
    process.exit(1);
  }

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    console.error(
      "⚠ Could not launch a headless browser — skipping prerender:",
      err.message
    );
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

  console.log(`Rendering ${routes.length} routes...\n`);

  let skipped = 0;
  for (const route of routes) {
    try {
      const html = await renderRoute(browser, route);
      if (isErrorSnapshot(html)) {
        // Don't overwrite a previously-good snapshot with an error page; leave
        // the old file (or no file) so the next build can self-correct.
        console.error(
          `  ⚠ ${route}: rendered an error/not-found state — skipping save`
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

  console.log(
    `\n✅ Prerendered ${routes.length} pages to dist/__prerendered/\n`
  );
}

main().catch((err) => {
  // Non-fatal: a prerender failure should not block the SPA deploy. Bots will
  // temporarily fall back to the client-rendered shell until the next build.
  console.error("⚠ Prerender step failed (continuing build):", err.message);
  process.exit(0);
});
