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

function saveHtml(routePath, html) {
  const safePath = routePath === "/" ? "/index" : routePath;
  const outFile = join(OUT, `${safePath}.html`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, "utf-8");
  console.log(`  ✓ ${routePath} → ${outFile.replace(DIST, "dist")}`);
}

async function renderRoute(browser, route) {
  const page = await browser.newPage();
  try {
    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    await page.waitForSelector("#root", { timeout: 10_000 });
    // Wait a bit for React to hydrate
    await new Promise((r) => setTimeout(r, 1500));
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

  console.log(`Rendering ${routes.length} routes...\n`);

  for (const route of routes) {
    try {
      const html = await renderRoute(browser, route);
      saveHtml(route, html);
    } catch (err) {
      console.error(`  ✗ ${route}: ${err.message}`);
    }
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
