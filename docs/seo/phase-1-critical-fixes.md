# Phase 1 — Critical Fixes (do first, same day)

Everything else in this plan is moot until these ship. All findings verified live on 2026-07-01, reproducible with cache-busting params.

## C1. Lesson/guide pages return 404 to all bots — 56 of 68 sitemap URLs un-indexable

**Impact:** The entire content moat (43 `/learn/*` + 13 `/guides/*` pages) is invisible to Googlebot, bingbot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended. This directly guts the AI-visibility/GEO project (Phase 2 shipped these 43 lessons for exactly this purpose). Explains AI visibility score stuck at 6.7/100.

**Evidence:**

- `curl -A "Googlebot/2.1" https://www.garzoni.app/learn/how-compound-interest-works` → `404`, 126-byte body
- Same for `/guides/garzoni-vs-ynab`, all 43 lesson URLs tested; cache-busting params rule out stale edge cache
- `x-vercel-cache: HIT`, `content-disposition: inline; filename="404.html"` — genuine static 404 from edge
- `/__prerendered/learn/how-compound-interest-works.html` → 404, while `/__prerendered/index.html`, `learn.html`, `guides.html` → 200 — **nested snapshots were never deployed**
- Public APIs work fine right now: `/api/public/lessons/` → 200 (count: 43), `/api/public/articles/` → 200 (count: 13)
- Local `dist/__prerendered/learn/` and `dist/__prerendered/guides/` are empty in this checkout

**Root cause chain:**

1. `frontend/scripts/prerender.mjs` fetches slugs and renders nested routes — but treats prerender failure as non-fatal ("a prerender failure should not block the SPA deploy"), so a silent Puppeteer/@sparticuz/chromium failure on the last production build shipped zero nested snapshots without failing CI.
2. `frontend/middleware.ts` rewrites bot requests to `/__prerendered{path}.html`.
3. The SPA catch-all rewrite in `frontend/vercel.json` explicitly **excludes** `__prerendered(?:/|$)`, so a missing snapshot falls through to `404.html` instead of the intended SPA-shell fallback (contradicting the comment at prerender.mjs:320).

**Fix plan:**

1. Check last Vercel production build log for the prerender step (look for `⚠ Could not launch a headless browser` or `✗ {route}: {error}`).
2. Remove the `__prerendered(?:/|$)` exclusion from the SPA catch-all in `frontend/vercel.json` — Vercel rewrites run after filesystem check, so existing snapshots still serve; misses fall back to `index.html` 200 instead of a hard 404.
3. Make prerender fail loudly: if `lessonSlugs.length === 0 || articleSlugs.length === 0` on a production build → `process.exit(1)`.
4. Redeploy; then add a post-deploy smoke test: curl 3–5 `/learn/*` + `/guides/*` URLs with a GPTBot UA, fail pipeline if any return non-200 or <1000 bytes.

**Falsifiability check:** after deploy, `curl -A "Googlebot/2.1" https://www.garzoni.app/learn/how-compound-interest-works` must return 200 with >10KB HTML containing the lesson H1.

## C2. Hero demo video CSP-blocked for 100% of visitors

**Impact:** "Watch demo" is a dead click for every visitor — the strongest above-fold conversion asset is silently broken. (Conversion, not crawl.)

**Evidence:** CSP is `default-src 'self'` with no `media-src`; `res.cloudinary.com/.../garzoni-demo.mp4` refused — 4 console errors in real Chromium load.

**Fix:** add `media-src 'self' https://res.cloudinary.com` to the CSP in `frontend/vercel.json`. One line.

## C3. Apex `.well-known` 307 redirect breaks App Links + Universal Links

**Impact:** Android App Links AND iOS Universal Links fail for the `garzoni.app` host — shared apex links don't deep-link into the app (install/deep-link path broken). Known issue, confirmed unchanged.

**Evidence:**

- `https://garzoni.app/.well-known/assetlinks.json` → 307 → www (both platforms require direct 200, no redirects)
- Same for `apple-app-site-association`
- Both mobile configs declare apex: `mobile/app.json` `associatedDomains: ["applinks:garzoni.app", ...]` + intent filter `host: "garzoni.app"` with `autoVerify: true`
- www copies are healthy: AASA valid (`R44TJX7U3C.app.garzoni.mobile`), assetlinks valid (2 SHA-256 fingerprints)

**Fix:** in `frontend/vercel.json` apex→www redirect, change source from `/:path*` to `/((?!\\.well-known/).*)` (keep host condition) so apex serves the files directly.

## C4. Broken 404.html self-redirect loop

**Evidence:** `frontend/public/404.html` body is only `window.location.href = "/" + pathname.replace(/^\//, "")` — strips leading slash then re-adds it → redirects to itself. This is the body bots currently see under C1.

**Fix:** replace with a real static 404 page (helpful links + app badges). Keep bot-side 404 status for genuinely missing URLs once C1 is fixed.

## C5. Duplicate/conflicting head tags on client-rendered lesson pages

**Impact:** rendered lesson HTML contains TWO canonicals — `https://www.garzoni.app/` (static shell) AND the lesson URL — plus duplicate `<title>` and meta description. If the prerenderer ever misses dedupe, every lesson canonicalizes to the homepage.

**Fix:** remove the hardcoded canonical from the static `index.html` shell (a wrong canonical is worse than none); verify Helmet replaces rather than appends title/description. Prerendered pages (/about) are clean today — verify nested routes stay clean after C1 fix.

## C6. Non-Google crawlers + social bots get homepage canonical on every route

**Impact:** `AI_BOT_RE` in `frontend/middleware.ts:3` omits Twitterbot, facebookexternalhit, LinkedInBot, WhatsApp, Slackbot, DuckDuckBot, YandexBot. Every social/DM share of a lesson shows the generic homepage card; non-Google engines consolidate the whole site into one URL.

**Evidence:** `curl -A "Twitterbot/1.0" .../guides/garzoni-vs-ynab` → SPA shell with `og:title="Garzoni - Personal Finance Education"` + `canonical=https://www.garzoni.app/`.

**Fix:** add `twitterbot|facebookexternalhit|linkedinbot|whatsapp|slackbot|telegrambot|discordbot|duckduckbot|yandex` to `AI_BOT_RE`.

## Key files

- `frontend/middleware.ts` — bot detection + rewrite
- `frontend/vercel.json` — rewrites, redirects, CSP, headers (NOTE: root `vercel.json` is stale/drifted from production — delete or align, see Phase 6)
- `frontend/scripts/prerender.mjs` — snapshot generation
- `frontend/public/404.html` — broken redirect stub
- `mobile/app.json` — associated domains / intent filters
