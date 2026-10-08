import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const OUT = join(DIST, "__prerendered");
const PORT = 4173;

/**
 * How many routes to render at once. Rendering was strictly sequential, which
 * made this script the longest pole in the Vercel build: ~56 routes × (page
 * load + up to 8s waiting for an <h1> + 500ms settle), one after another.
 *
 * Each worker owns its own Chrome page against the same browser, so the cost is
 * memory, not correctness. 5 is conservative for the Vercel build container;
 * override with PRERENDER_CONCURRENCY if it ever OOMs (1 restores the old
 * behaviour exactly).
 */
const CONCURRENCY = Math.max(1, Number(process.env.PRERENDER_CONCURRENCY) || 5);

/**
 * Snapshot cache, reused across builds.
 *
 * Vercel restores `node_modules/.cache` between builds, so a rebuild that does
 * not change lesson content can copy the previous snapshot instead of driving
 * Chrome again. Keyed on both the *content* fingerprint (from the public API)
 * and a *shell* fingerprint (a hash of the freshly built index.html, which
 * carries the hashed asset filenames) — if the bundle changes, every snapshot
 * is re-rendered, because a stale snapshot would reference assets that no
 * longer exist.
 *
 * That means a normal code push still re-renders everything; the cache pays off
 * on redeploys that don't change the bundle (manual redeploy, env-var change,
 * content-only publish).
 */
const CACHE_DIR = join(
  __dirname,
  "..",
  "node_modules",
  ".cache",
  "garzoni-prerender"
);
const CACHE_MANIFEST = join(CACHE_DIR, "manifest.json");

/**
 * Bump when this script changes what goes into a snapshot without the bundle
 * changing, so snapshots cached the old way are re-rendered.
 */
const SNAPSHOT_FORMAT = "3";

const sha1 = (value) =>
  createHash("sha1").update(String(value)).digest("hex").slice(0, 16);

/**
 * Run `worker` over `items` with at most `limit` in flight. Results are not
 * collected — each worker reports its own outcome — so a single failure never
 * rejects the pool.
 */
async function mapPool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, () =>
    (async () => {
      for (;;) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    })()
  );
  await Promise.all(runners);
}

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

/**
 * Fetch that retries transient backend failures.
 *
 * A Railway rollover takes the old container down before the new one serves,
 * so requests in that window return 502 — and the first request per route
 * after boot can take 2–5s while caches are cold. Both were observed hitting
 * /api/public/lessons/<slug>/ in production. Without a retry the build happily
 * snapshots a "Lesson not found" page and ships it as the SEO artefact, which
 * is worse than a slow build.
 *
 * Retries network errors and 5xx only. A 404 is a real answer — retrying it
 * would just slow the build down.
 */
async function fetchWithRetry(url, options = {}, { attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (res.status < 500 || attempt === attempts) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;
    }
    const backoffMs = 500 * attempt;
    console.log(
      `  ↻ retry ${attempt}/${attempts - 1} in ${backoffMs}ms (${lastError.message}) ${url}`
    );
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
  throw lastError;
}

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
    const res = await fetchWithRetry(target, {
      method: req.method(),
      headers: { accept: "application/json" },
    });
    const body = await res.text();
    if (res.status >= 500) {
      // Retries are already exhausted here. Say so — otherwise the page silently
      // renders its not-found state and gets snapshotted as if it were correct.
      console.error(`  ⚠ api ${res.status} after retries for ${target}`);
    }
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
  "/ro",
  "/about",
  "/authors/andrei-neagoe",
  "/editorial-standards",
  "/calculators/compound-interest",
  "/ro/calculators/compound-interest",
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
const ERROR_MARKERS = [
  "Guide not found",
  "Lesson not found",
  // Romanian twins (publicGuides/publicLesson.notFoundTitle in the ro locale).
  "Ghid negăsit",
  "Lecție negăsită",
];

function isErrorSnapshot(html) {
  return ERROR_MARKERS.some((marker) => html.includes(marker));
}

function cacheFile(routePath) {
  const safePath = routePath === "/" ? "/index" : routePath;
  return join(CACHE_DIR, "snapshots", `${safePath}.html`);
}

function writeCacheFile(routePath, html) {
  try {
    const file = cacheFile(routePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html, "utf-8");
  } catch {
    // The cache is an optimisation; a build must never fail because of it.
  }
}

/**
 * Hash of the freshly built index.html. It embeds the content-hashed asset
 * filenames, so any bundle change changes this — which is exactly when every
 * cached snapshot must be discarded (a stale snapshot would reference JS/CSS
 * that no longer exists in dist/).
 */
function shellHash() {
  try {
    return sha1(
      SNAPSHOT_FORMAT + readFileSync(join(DIST, "index.html"), "utf-8")
    );
  } catch {
    return "no-shell";
  }
}

function loadSnapshotCache() {
  const shell = shellHash();
  try {
    const manifest = JSON.parse(readFileSync(CACHE_MANIFEST, "utf-8"));
    if (manifest.shell === shell && manifest.routes) {
      return { shell, routes: manifest.routes };
    }
    // Bundle changed — drop the whole snapshot cache rather than serve
    // snapshots pointing at assets this build no longer contains.
    rmSync(join(CACHE_DIR, "snapshots"), { recursive: true, force: true });
  } catch {
    // No usable cache.
  }
  return { shell, routes: {} };
}

/**
 * Content fingerprints from the previous build, kept even when the bundle changed
 * (loadSnapshotCache drops them then). Used only to tell IndexNow which pages'
 * content actually changed.
 */
function loadPreviousFingerprints() {
  try {
    const manifest = JSON.parse(readFileSync(CACHE_MANIFEST, "utf-8"));
    return Object.fromEntries(
      Object.entries(manifest.routes || {}).map(([route, e]) => [route, e?.fp])
    );
  } catch {
    return {};
  }
}

// Public by design: IndexNow verifies ownership by fetching /<key>.txt.
const INDEXNOW_KEY = "53fde4032ad192dc911e87f41973ce8d";
const SITE = "https://www.garzoni.app";

/**
 * Tell IndexNow (Bing, Yandex, Seznam, Naver — Bing feeds Copilot and ChatGPT
 * search) which content pages changed in this deploy. Best-effort, never fatal.
 */
async function pingIndexNow(routes) {
  if (routes.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "www.garzoni.app",
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList: routes.map((route) => `${SITE}${route}`),
      }),
    });
    console.log(
      `  ✓ IndexNow: ${routes.length} changed URL(s) → ${res.status}`
    );
  } catch (err) {
    console.error("  ⚠ IndexNow ping failed:", err.message);
  }
}

function saveSnapshotCache(cache) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_MANIFEST, JSON.stringify(cache), "utf-8");
  } catch {
    // Optimisation only.
  }
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

/** `src` of every <script> the built shell ships — the app's own entry chunk. */
function shellScriptSrcs() {
  const html = readFileSync(join(DIST, "index.html"), "utf-8");
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Make the snapshot safe to hand to a visitor, not only a crawler.
 *
 * - Scripts the app injected at runtime (Customer.io track.js, reCAPTCHA) are
 *   dropped. Served back, they would load ahead of the app, whose loaders then
 *   find the tag and skip their own setup (Customer.io's account is set in its
 *   tag's onload). Only the shell's entry script stays.
 * - Iframes outside the app root go for the same reason.
 * - `[data-prerender-omit]` (the cookie banner) is per-visitor state: someone
 *   who already answered would see it until the app takes over.
 * - `data-prerendered` records the UI language the page was rendered in, so the
 *   shell can hide a snapshot whose chrome is in the visitor's other language.
 */
async function prepareSnapshot(page, keepScripts, uiLang) {
  await page.evaluate(
    (keep, lang) => {
      for (const el of Array.from(document.querySelectorAll("script[src]"))) {
        if (!keep.includes(el.getAttribute("src"))) el.remove();
      }
      const root = document.getElementById("root");
      for (const el of Array.from(document.querySelectorAll("iframe"))) {
        if (!root || !root.contains(el)) el.remove();
      }
      for (const el of Array.from(
        document.querySelectorAll("[data-prerender-omit]")
      )) {
        el.remove();
      }
      document.documentElement.setAttribute("data-prerendered", lang);
    },
    keepScripts,
    uiLang
  );
}

/**
 * UI language (navbar, footer, chrome) a route's snapshot is rendered in: the
 * /ro pages get Romanian chrome around their Romanian content, so the visitors
 * they are for get the snapshot rather than one the shell hides as stale.
 */
const uiLanguageFor = (route) =>
  route === "/ro" || route.startsWith("/ro/") ? "ro" : "en";

/**
 * One browser context per UI language. Pages in a context share localStorage,
 * where the app persists its language, so mixing languages in one context would
 * let a render pick up another page's language.
 */
async function createLanguageContexts(browser) {
  return {
    en: await browser.createBrowserContext(),
    ro: await browser.createBrowserContext(),
  };
}

async function renderRoute(contexts, route, keepScripts) {
  const uiLang = uiLanguageFor(route);
  const page = await contexts[uiLang].newPage();
  // Pin the UI language: the app's i18n reads this key before
  // navigator.language, so the build machine's locale never leaks in.
  await page.evaluateOnNewDocument((lang) => {
    try {
      window.localStorage.setItem("garzoni:lang", lang);
    } catch {
      // No storage — navigator.language decides.
    }
  }, uiLang);
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
    await prepareSnapshot(page, keepScripts, uiLang);
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

/**
 * Fetch a public content list, returning the full objects rather than just
 * slugs — the rest of the object (title, updated_at, …) is what the snapshot
 * cache fingerprints against to decide whether a page needs re-rendering.
 */
async function fetchPublicList(path, label, query = "") {
  try {
    const apiBase =
      process.env.VITE_API_URL || "https://garzoni-production.up.railway.app";
    const res = await fetchWithRetry(`${apiBase}/api/public/${path}/${query}`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.filter((item) => item && item.slug);
  } catch {
    console.log(
      `  ⚠ Could not fetch ${label} (API may not have the endpoint yet)`
    );
    return [];
  }
}

const fetchPublicLessons = () =>
  fetchPublicList("lessons", "public lesson slugs");
const fetchPublishedArticles = () =>
  fetchPublicList("articles", "published article slugs");

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
      const res = await fetchWithRetry(`${base}/public/lessons/${slug}/`);
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
      const res = await fetchWithRetry(`${base}/public/articles/${slug}/`);
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

  // Content fingerprints per route, used by the snapshot cache below. Static
  // routes are app-driven and carry no content fingerprint, so they ride on the
  // shell hash alone.
  const fingerprints = new Map();
  const routes = [...STATIC_ROUTES];

  const lessons = await fetchPublicLessons();
  const lessonSlugs = lessons.map((l) => l.slug);
  for (const lesson of lessons) {
    const route = `/learn/${lesson.slug}`;
    routes.push(route);
    fingerprints.set(route, sha1(JSON.stringify(lesson)));
  }

  const articles = await fetchPublishedArticles();
  const articleSlugs = articles.map((a) => a.slug);
  for (const article of articles) {
    const route = `/guides/${article.slug}`;
    routes.push(route);
    fingerprints.set(route, sha1(JSON.stringify(article)));
  }

  // Romanian twins. The ?lang=ro lists hold only fully translated items (the
  // detail API 404s the rest), and a /ro index is only rendered when it has
  // something to list — matching what sitemap.xml advertises.
  const roLists = [
    [
      await fetchPublicList("lessons", "ro lesson slugs", "?lang=ro"),
      "/ro/learn",
    ],
    [
      await fetchPublicList("articles", "ro article slugs", "?lang=ro"),
      "/ro/guides",
    ],
  ];
  for (const [items, base] of roLists) {
    if (items.length === 0) continue;
    routes.push(base);
    for (const item of items) {
      const route = `${base}/${item.slug}`;
      routes.push(route);
      fingerprints.set(route, sha1(JSON.stringify(item)));
    }
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

  const previousFingerprints = loadPreviousFingerprints();
  const cache = loadSnapshotCache();
  const nextCache = { shell: cache.shell, routes: {} };

  const cached = [];
  const toRender = [];
  for (const route of routes) {
    const fingerprint = fingerprints.get(route);
    const entry = fingerprint ? cache.routes[route] : undefined;
    if (entry && entry.fp === fingerprint && existsSync(cacheFile(route))) {
      cached.push(route);
    } else {
      toRender.push(route);
    }
  }

  for (const route of cached) {
    saveHtml(route, readFileSync(cacheFile(route), "utf-8"));
    nextCache.routes[route] = cache.routes[route];
  }

  console.log(
    `Rendering ${toRender.length} routes (${cached.length} reused from cache), ` +
      `${CONCURRENCY} at a time...\n`
  );

  let skipped = 0;
  const keepScripts = shellScriptSrcs();
  const contexts = await createLanguageContexts(browser);
  await mapPool(toRender, CONCURRENCY, async (route) => {
    try {
      // A not-found render or a navigation timeout for a route we know exists is
      // a transient API hiccup mid-build — typically Railway rolling the backend
      // over while this build runs, which 502s for ~15s per request. Retry with
      // backoff before giving up so a blip never costs us the page (it cost
      // /learn and /guides their snapshots on 2026-10-03).
      let html;
      for (let attempt = 0; ; attempt++) {
        try {
          html = await renderRoute(contexts, route, keepScripts);
          if (!isErrorSnapshot(html) || attempt === 2) break;
          console.error(
            `  ↻ ${route}: error state, retry ${attempt + 1}/2 after backoff…`
          );
        } catch (err) {
          if (attempt === 2) throw err;
          console.error(
            `  ↻ ${route}: ${err.message}, retry ${attempt + 1}/2 after backoff…`
          );
        }
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      }
      if (isErrorSnapshot(html)) {
        // Still bad — don't overwrite a previously-good snapshot with an error
        // page; leave the old file (or none) so the next build self-corrects.
        console.error(
          `  ⚠ ${route}: still error after retries — skipping save`
        );
        skipped++;
        return;
      }
      saveHtml(route, html);
      const fingerprint = fingerprints.get(route);
      if (fingerprint) {
        writeCacheFile(route, html);
        nextCache.routes[route] = { fp: fingerprint };
      }
    } catch (err) {
      console.error(`  ✗ ${route}: ${err.message}`);
    }
  });
  if (skipped > 0) {
    console.log(
      `\n⚠ Skipped ${skipped} route(s) that rendered an error state.`
    );
  }

  saveSnapshotCache(nextCache);

  const written = routes.filter((route) =>
    existsSync(join(OUT, `${route === "/" ? "/index" : route}.html`))
  );

  if (isVercelProduction) {
    await pingIndexNow(
      written.filter(
        (route) =>
          fingerprints.has(route) &&
          previousFingerprints[route] !== fingerprints.get(route)
      )
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
