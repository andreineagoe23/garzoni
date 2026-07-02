# Phase 6 — Performance (CWV) & Monitoring

Lab data (Lighthouse 13 mobile preset + Playwright/CDP cross-check, 2026-07-01). PSI API rate-limited all session; CrUX field data unavailable — re-run `pagespeed_check.py` later to confirm 75th-percentile field values.

## Mobile CWV — homepage

| Metric | Lighthouse | Playwright confirm | Threshold | Verdict |
|---|---|---|---|---|
| Performance score | 48/100 | — | — | Poor |
| LCP | 9.2s | 4.1s | ≤2.5s | **FAIL** (both sources >4s) |
| CLS | 0.037 (short trace) | **0.6365** (6s settle) | ≤0.1 | **FAIL** — single 0.602 shift |
| TBT (INP proxy) | 541ms | ~220–240ms | ≤200ms | FAIL/borderline |
| FCP | 5.5s | 3.4s | — | Poor |
| TTFB | 34ms | ~110ms | ≤200ms | Good — server not the bottleneck |

**Desktop unthrottled: all Good** (LCP 0.98s, CLS 0.002, TBT ~136ms). This is a mobile-only problem — exactly the segment deciding whether to download the app.

## P1. CLS 0.602 single-event footer collapse (highest-leverage fix)

At t≈4.3s, `FOOTER.app-footer` + a `DIV.rounded-3xl.border` card collapse from 386×551px → 0×0. Likely lazy-loaded `Footer-Ca-cT6UG.js` chunk swapping a full-height placeholder to empty (Suspense fallback / conditional render).
**Fix:** reserve dimensions (min-height matching final render) on the footer/card container. One change moves CLS Poor → Good.
Minor contributors: cookie/sticky bottom bar resize (+0.01); font-swap reflow (+0.02).

## P2. Render-blocking CSS — ~1,260ms

- `fonts.googleapis.com/css2?family=Inter...` = **864ms** blocking (extra DNS/connect round-trip) — the single biggest render-blocker.
- `assets/index-A68992qW.css` 360ms + `Welcome-*.css` + `marketing-*.css` — all 4 stylesheets synchronous.

**Fix:** self-host Inter/JetBrains Mono (Fontsource) — biggest available LCP win; inline critical CSS; defer non-critical.

## P3. JS payload

- 461KB unused JS; `vendor-react-*.js` 1,154ms main-thread, `index-C9FP-Cva.js` 779ms — bulk of TBT.
- Three.js particle globe (`vendor-three-*.js`) on a mobile marketing page = expensive main-thread/GPU for decoration.
- Legacy polyfills (Object.entries, 9KB) — modernize browserslist target.
- Stripe (`m.stripe.com`, 175ms RTT) loads eagerly on marketing homepage — defer to checkout-adjacent pages.

**Fix:** route-level code splitting (marketing page shouldn't ship the app bundle), drop/defer Three.js, modern build target.

## P4. Images

- Logo `garzoni-logo-white-rectangular.png`: served 1200×1200, displayed 48×48 — **156.6KB of 156.9KB wasted (99.8%)**, no width/height attrs. Fix: SVG or 96×96 WebP + explicit dimensions.
- Logo loads from `garzoni-production.up.railway.app` — third origin, no preconnect; serve same-origin or Cloudinary.
- BMC button: lazy-load (footer).

## P5. Caching bug

Hashed assets get `cache-control: max-age=0, must-revalidate` — the immutable rule in vercel.json targets `/static/(.*)` but Vite emits `/assets/`.
**Fix:** header source → `/assets/(.*)` = `public, max-age=31536000, immutable`. Free repeat-visit win.

## P6. Monitoring / infra gaps

| Item | Finding | Fix |
|---|---|---|
| IndexNow | Not implemented (no key file, zero repo refs) | Key file in `frontend/public/`, submit via `~/.claude/skills/seo/scripts/indexnow_submit.py` post-deploy |
| Sitemap lastmod | All 68 URLs dynamically stamped today's date — Google ignores lying lastmod | Emit real content-updated dates; drop /login, /register from sitemap |
| Soft-200s | Unknown paths return 200 SPA shell (also fakes /indexnow.txt checks) | SPA not-found state + real /404 snapshot |
| Config drift | Root `vercel.json` ≠ `frontend/vercel.json` (live); differing CSP/rewrites — how C1-style regressions ship | Delete or align root config |
| GA4 ↔ Searchable | All Searchable GA4 endpoints return empty (sources, pages, AI referrals) | Reconnect GA4 property in Searchable |
| CrUX | No field data this session | Re-run PSI/CrUX after quota reset; homepage may lack CrUX traffic |
| Trailing slash | `/learn/` 200s without redirect (and 404s for bots pre-C1) | `"trailingSlash": false` in vercel.json |
| HSTS | www: 31536000 +includeSubDomains; apex: 63072000 without | Align; consider preload |
| lang mismatch | Shell `en-GB` vs prerendered `en` | Pick one (no hreflang needed while public pages EN-only) |

## Priority order

P1 (CLS footer) → P2 (self-host fonts) → P4 logo (near-zero effort) → P5 caching (one line) → P3 JS diet → P6 items opportunistically.

## Verification

- Re-run Lighthouse mobile after P1/P2: expect CLS <0.1, LCP <4s lab.
- Reusable measurement scripts saved in session scratchpad (`cwv_measure.py`, `cls_sources.py`).
