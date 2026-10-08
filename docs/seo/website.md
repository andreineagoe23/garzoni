# Website

> www.garzoni.app is both the web app and the public marketing site. Logged-out visitors get a
> landing page, free lessons, guides and calculators in English and Romanian; logged-in users get
> the full learning app. Content pages are pre-built at deploy time and served to both people and
> search engines, so they appear instantly and are fully indexable. Every visitor path leads to one
> of three places: sign up in the browser, the App Store, or Google Play.

_Last reviewed: 2026-10-08._

## Pages

| Route                                                                             | What                                                                                               | Languages | Pre-built     | Indexed |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------- | ------------- | ------- |
| `/`                                                                               | Landing page: hero, live stats, topics, compound-interest demo, plans, download band with QR       | en        | crawlers only | yes     |
| `/ro`                                                                             | Romanian landing page (always Romanian; doesn't change the visitor's language setting)             | ro        | crawlers only | yes     |
| `/learn`, `/learn/<slug>`                                                         | Free lessons hub and lesson pages (73 lessons: curated ones plus the first lesson of every course) | en        | yes           | yes     |
| `/ro/learn`, `/ro/learn/<slug>`                                                   | Romanian lessons (only fully translated ones)                                                      | ro        | yes           | yes     |
| `/guides`, `/guides/<slug>`                                                       | 20 long-form guides and app comparisons                                                            | en        | yes           | yes     |
| `/ro/guides/<slug>`                                                               | 7 Romanian guides                                                                                  | ro        | yes           | yes     |
| `/calculators/compound-interest`, `/savings-goal`, `/50-30-20-budget`             | Free calculators in £                                                                              | en        | yes           | yes     |
| `/ro/calculators/...`                                                             | The same three calculators in lei                                                                  | ro        | yes           | yes     |
| `/about`, `/authors/andrei-neagoe`, `/editorial-standards`                        | Company, author and editorial pages                                                                | en        | yes           | yes     |
| `/privacy-policy`, `/cookie-policy`, `/terms-of-service`, `/financial-disclaimer` | Legal                                                                                              | en        | yes           | yes     |
| `/subscriptions` (`/pricing` redirects here)                                      | Plans and checkout                                                                                 | en/ro     | crawlers only | yes     |
| `/login`, `/register`, `/forgot-password`                                         | Account pages                                                                                      | en/ro     | no            | noindex |
| `/get`                                                                            | Redirect: sends phones to their store, desktops to the homepage                                    | —         | —             | —       |
| Everything else                                                                   | The logged-in app (see the other module pages)                                                     | en/ro     | no            | no      |

Unknown URLs show a "Page not found" page marked `noindex`. Dead lesson, guide and author URLs
return a real 404.

## Getting visitors into the app

- **Desktop:** the hero's main button is "Start free in your browser" (`/register`). Store badges
  and a QR code at the bottom of the page (it opens `/get`) cover people who'd rather use their phone.
- **Phone:** only that phone's store badge is shown, and the header button says "Get the app".
- **Public lessons:** the call to action is `/register?next=/lessons/<course>/flow`. After sign-up
  and onboarding the user lands straight in that course. If the course needs Plus or Pro, they see
  an upgrade prompt rather than an error.
- **Store links carry campaign tags** so installs can be attributed: App Store links include the
  provider id (`pt=128738216`) and `ct=web_<placement>`; Google Play links carry a `utm_*` install
  referrer. Placements: `hero`, `download_band`, `lesson_footer`, `marketing`, `pricing_promo`,
  `download_qr`.
- **`/get?c=<campaign>`** is the one link for bios, emails and QR codes.
- **Referral links** (`/?ref=CODE`, and the old `/welcome?ref=CODE`) keep the code through sign-up.

## SEO and AI-search infrastructure

- **Pre-built pages.** At each production deploy, `frontend/scripts/prerender.mjs` renders every
  public route in headless Chrome and saves a snapshot. Content routes are served from the snapshot
  to everyone; the landing pages to crawlers only (they animate on load). The React app takes over
  the snapshot in the browser without a visible flash. A production build **fails** if any route is
  missing its snapshot, so gaps can't ship as 404s.
- **Sitemap** is generated by the backend (`/sitemap.xml`, about 190 URLs), with `lastmod` and
  English/Romanian `hreflang` pairs.
- **Structured data:** Organization (founder, alternate names, social profiles), WebSite,
  WebApplication and MobileApplication on every page; Article, Course, FAQ and Breadcrumb on content
  pages.
- **Share images:** each lesson, guide, calculator and author page has its own 1200×630 card
  (`frontend/scripts/og-card.mjs`), generated at build and cached by title.
- **IndexNow:** each production build notifies Bing and others of changed lesson and guide URLs.
- **AI crawlers:** `robots.txt` allows GPTBot, ClaudeBot, PerplexityBot and others, and Cloudflare is
  set to let them through. `/llms.txt` gives a fact sheet; `/llms-full.txt` is the plain text of every
  public lesson and guide.

## Analytics and attribution

- **Vercel Web Analytics** — cookieless page views on the production hosts.
- **Google Analytics 4** — loads only after cookie consent; fires `sign_up` on web registration.
- **First-touch attribution** — the first `utm_*` parameters, referrer and landing page are stored in
  the browser and saved on the user (`UserProfile.signup_attribution`) when they register.
- **Funnel events** are recorded server-side for the pricing funnel dashboard (staff only).

## Under the hood

| Piece                         | Where                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Routes                        | `frontend/src/routes/AppRoutes.tsx`, `lazyPages.ts`                                             |
| Landing page                  | `frontend/src/components/landing/` (`home/` holds the sections)                                 |
| Public lessons and guides     | `frontend/src/components/learn/`, `guides/`; API in `backend/education/views_public.py`         |
| Calculators                   | `frontend/src/components/calculators/`; maths in `packages/core/src/utils/calculators.ts`       |
| Edge routing                  | `frontend/middleware.ts` (snapshots, `/get`), `frontend/vercel.json` (redirects, 404s, headers) |
| Pre-rendering and share cards | `frontend/scripts/prerender.mjs`, `frontend/scripts/og-card.mjs`                                |
| Head tags and schema          | `frontend/src/components/seo/SeoHead.tsx`, `frontend/index.html`                                |
| Store links                   | `frontend/src/utils/storeLinks.ts`                                                              |
| Attribution                   | `frontend/src/utils/firstTouch.ts`                                                              |

## Known gaps

- Several public lessons contain outdated UK figures; see
  [`docs/content/eeat-drafts-2026-10.md`](../content/eeat-drafts-2026-10.md).
- Most existing lesson sources point to US agencies, not UK or Romanian ones.
- Only 7 of 20 guides are in Romanian; the competitor comparisons are deliberately English-only.
- A few public lessons have near-duplicate titles (two "Technical Analysis Basics", two DeFi intros).
- The author page has no photo or personal LinkedIn yet.
