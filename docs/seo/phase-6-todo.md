# Phase 6 — perf/monitoring to-do (deferred / needs a call)

Companion to [phase-6-performance-monitoring.md](./phase-6-performance-monitoring.md).
The safe high-value fixes shipped (see that file's "Shipped in code" block).
These are left out on purpose — they need an asset, a product decision, or
off-repo access.

## P3 — JS diet (biggest remaining perf lever, needs decisions)

- **461KB unused JS**; `vendor-react` ~1,154ms + `index` ~779ms main-thread =
  bulk of TBT. Route-level code splitting so the marketing homepage doesn't ship
  the app bundle.
- **Three.js particle globe** (`vendor-three`) renders on the mobile marketing
  page — expensive main-thread/GPU for decoration. Drop it on mobile, or replace
  with a static image / lazy-load below interaction. **Product/visual call** —
  not done blind.
- Modernize browserslist target (drop legacy polyfills, ~9KB).
- Defer Stripe (`m.stripe.com`) off the marketing homepage to checkout-adjacent
  routes.

## P4 — Logo (needs an asset)

Nav/Header logo is served **1200×1200 for a 48–80px display** from
`garzoni-production.up.railway.app` (third origin, no preconnect) — ~156KB
wasted. Fix needs a real small **rectangular** wordmark (SVG or ~2× WebP) served
same-origin; the current `public/logo-*.png` are square PWA icons, not the
wordmark. Add explicit intrinsic `width`/`height` once the asset exists (can't
guess the aspect without distorting). Files: `Navbar.tsx`, `Header.tsx`.

## Config / infra (off-repo or deploy-config decisions)

- **root `vercel.json` vs `frontend/vercel.json` drift** — both now carry the P5
  - CSP-font fixes, but they still diverge (root CSP lacks `media-src`,
    customer.io, stripe). `frontend/` is the live one. Decide: delete root, or keep
    it fully in sync. Left in place — deleting is a Vercel project-root decision.
- **GA4 ↔ Searchable** — all Searchable GA4 endpoints return empty; reconnect the
  GA4 property so traffic/AI-referral data flows.
- **CrUX / PSI** — re-run `pagespeed_check.py` after quota reset to confirm
  75th-percentile field CWV (homepage may lack CrUX traffic).
- **HSTS apex** — apex `max-age=63072000` without `includeSubDomains`; www has it.
  Align at the domain/platform level; consider `preload`.
- **lang mismatch** — shell `<html lang="en-GB">` vs Helmet/prerender `en`.
  Cosmetic while EN-only; pick one if it ever matters.
- **Soft-200s** — unknown paths return the 200 SPA shell (also fakes
  `/indexnow.txt`-style checks). Consider a real SPA not-found state + `/404`
  snapshot.

## Verify after deploy

- Repeat-visit: hashed `/assets/*` return `cache-control: immutable`.
- Fonts load same-origin (no `fonts.googleapis.com` request); no CSP violations
  in console.
- Re-run Lighthouse mobile: expect CLS <0.1 (footer reserved) and LCP down from
  self-hosted fonts.
- IndexNow: `curl https://www.garzoni.app/53fde4032ad192dc911e87f41973ce8d.txt`
  returns the key, then run the submitter.
