# Growth audit — visibility, SEO, ASO, AI search, signups (2026-10-02)

**Status:** CURRENT PLAN. Supersedes the priority order in `docs/seo/README.md` (July) and
`docs/aso/aso-audit-2026-07-07.md`; those stay as detail references.

**Method:** five parallel read-only recon passes (live web as each crawler, both store listings +
keyword ranks, funnel code, off-site/AI search, prod data) on 2026-10-02, then spot-verified by hand.
Every number below was measured that day unless marked UNVERIFIED.

---

## 1. Where we actually are

| Metric | Value | Source |
| --- | --- | --- |
| Users, all time | 115 (public stats says 111 learners) | prod DB |
| Signups / week since mid-July | **1–5, median 3** | prod DB |
| Signups, last 90 days by platform | iOS 46 · Android 10 · **web 0** | `UserProfile.signup_platform` |
| Activated (lesson within 7 days) | Jun 10% · Jul 10% · Aug 40% · Sep 33% | prod DB |
| Active last 7 / 30 days | 3 / 22 (iOS 17, Android 4, web 1) | prod DB |
| Paying | 1 active, 1 trialing | prod DB |
| iOS ratings | GB 5.0 × 4 · RO 5.0 × 7 · US 0 | iTunes lookup |
| Play installs | 10+ | Play page |
| Web traffic | **unknown** — Vercel Web Analytics is not enabled; GA4 is consent-gated and unread | Vercel API 404 |
| Off-site mentions | none found in any unbranded query, EN or RO | search |

**Diagnosis in one paragraph.** The App Store is the only acquisition channel that works, and it
works through long-tail education searches (`finance learning` #25, `money lessons` #51 in GB). The
website has produced **zero web signups ever recorded** (web clients stamp `X-Garzoni-Platform: web`
— `frontend/src/bootstrap/httpClientWeb.ts:13` — and no user carries it), because the landing page
has no web signup CTA, only store badges, and nothing attributes the badge clicks. So the web's
contribution is invisible, not proven zero. Store rank is driven by install velocity, conversion and
ratings; keyword fields only make us *eligible*. At ~3 installs/week, keyword work alone will not
move rank. The plan therefore does four things in order: **measure → stop leaks → convert the
impressions we already get → open channels where competition is near zero (Romania, long-tail,
free tools) → build off-site signals that compound.**

**Where we can win, and where we can't:**
- **Can't win soon:** `budgeting`, `personal finance`, `budget app` head terms — Emma (26.7k
  ratings), Plum (70.9k), Moneybox (78.9k). Don't spend subtitle characters chasing them.
- **Can win:** education long-tail (`financial literacy`, `learn finance`, `money lessons`,
  `finance quiz`, `learn investing`) — closest competitors are Investmate 2.5k, Juno 1.9k, Bloom
  156 ratings.
- **Wide open: Romania.** `educatie financiara` returns **18 apps total** on the RO App Store; no
  adult/young-adult gamified finance app exists in Romanian in search or press. We already have
  more RO ratings (7) than GB (4), and no RO iOS listing yet.

---

## 2. Last session's claims, checked

| Claim | Verdict |
| --- | --- |
| 25 RO lesson pages live with hreflang | True. But 13 render "Conținut de adăugat." — root cause is the **English** `Lesson.detailed_content` seed text `<p>Content to be added.</p>` (from `add_missing_courses`), shown on 13 public EN pages too and translated literally. Sections hold the real prose. **Fixed in Phase 1** (public API blanks the placeholder). |
| Author + editorial pages live, bylines on lessons | True. `editorial.ts` still has `image: ""`, `sameAs: []`. |
| Homepage canonical, `/marketing` out of sitemap, llms.txt lists Android | True. |
| Sitemap includes author/editorial/RO URLs | True — 100 URLs (44 learn, 26 ro/learn, 21 guides, 1 author, 8 other). **lastmod values are stale** (2026-03-04 on 50 URLs). |
| £ formatting in app | In repo, ships with 1.2.1. Not live. |
| store-listing.md, iOS keywords, RO App Store listing | In repo / local `store.config.json`. **Not live.** |
| Feature graphic + screenshot templates | Feature graphic done. **`store-assets/captures/{en,ro}` hold only `.gitkeep`** — every rendered screenshot is a placeholder panel. |
| Play en-GB "500+" | **Still live**, three times, plus "Pro unlocks the full library" (Plus and tools missing). |
| First lesson of each course public | Not done — still 43 public EN lessons. |

Also verified today: paywall yearly misprice is **fixed** (`mobile/app/subscriptions.tsx:413-427`);
prod `UX_PAYWALL_PLACEMENT=post_first_lesson` is **set**; `STREAK_MIN_TO_ARM = 1`
(`mobile/src/streak/streakReminder.ts:14`); `customerio-expo-plugin` is wired
(`mobile/app.config.js:298`). Those retention-teardown items are closed.

---

## 3. Findings by surface

### 3.1 Web — technical SEO

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| W1 | Bot allowlist misses **Google-InspectionTool** (Search Console URL Inspection + Rich Results Test), **Claude-User**, **Perplexity-User**, GoogleOther, Amazonbot, CCBot. They get the empty SPA shell (0 words, no H1). Live checks in GSC will show a blank page and mislead. | `frontend/middleware.ts:3-4`; curl with each UA | High |
| W2 | Soft 404s everywhere: `/zzz`, `/learn/does-not-exist`, `/guides/nope`, `/authors/nobody` → **200** + `index, follow` shell. | curl | High |
| W3 | 13 EN + 13 RO pages publish "Content to be added." as the lesson intro (see §2). | curl + API | High |
| W4 | `/welcome` is indexed (it's the only `site:` hit besides the store) and is a client-side `<Navigate to="/">`, i.e. a 200 shell. | `frontend/src/routes/AppRoutes.tsx:184` | Med |
| W5 | Sitemap `lastmod` is honest (newest section edit; content really was last touched in March) — no change needed. IndexNow key file is published (`frontend/public/53fde…txt`) but **nothing pings IndexNow**. Bing's index feeds ChatGPT search and Copilot. | grep | Med |
| W6 | Duplicate title "Garzoni - Personal Finance Education" on `/subscriptions`, `/cookie-policy`, `/financial-disclaimer`; `/subscriptions` has no H1; 6 lesson descriptions 65–69 chars; `/about` 180. | crawl | Low |
| W7 | Homepage JSON-LD `AggregateRating` sits on the `MobileApplication` node and mirrors the real App Store rating shown on the page — **not** self-serving; keep it, update the count as ratings grow. | crawl | — |
| W12 | **Organization `sameAs` and the site footer linked `linkedin.com/company/garzoni` (a Swiss construction firm) and a TikTok handle that doesn't exist** — tells Google our entity is that company. Fixed in Phase 1. | `index.html`, `Footer.tsx` | High |
| W8 | One `og:image` site-wide — every shared lesson/guide previews identically. | crawl | Low |
| W9 | Prerender is UA-sniffed (dynamic rendering). Google calls this a workaround; humans get a 0-word shell until JS runs. Serving the prerendered HTML to *everyone* fixes W1 permanently and improves LCP. | `frontend/middleware.ts` | Med (structural) |
| W10 | ClaudeBot/GPTBot spoofed UAs got Cloudflare 403 from some IPs but 200 from others — consistent with Cloudflare verifying bot IPs, **not** a block on the real crawlers. UNVERIFIED — check Cloudflare → AI Crawl Control. | curl | Verify |
| W11 | CWV / CrUX field data — PSI quota exhausted. UNVERIFIED. July lab: mobile 48/100, Three.js globe on the marketing page. | — | Verify |

### 3.2 Web — content and E-E-A-T

- 43 public EN lessons (avg ~790 words incl. ~280 of chrome), 21 guides (avg ~540), 25 RO lessons.
- Thinnest guides are the ones meant to capture comparison/download intent: `garzoni-vs-acorns`
  432, `garzoni-vs-cleo` 441, `how-credit-scores-work-uk` 427, `investing-basics-for-beginners` 424.
- Lesson **Sources** block is wired but empty (Phase 4 E2) — YMYL pages with zero citations.
- No author photo, no LinkedIn `sameAs`.
- **No public free tools.** `/tools/*` is auth-only and disallowed in robots. Calculators are the
  single most reliable traffic + backlink magnet in personal finance, and we already have them built.
- No RO guides, no RO homepage, no `/ro` landing.

### 3.3 Web — conversion (visitor → signup)

| # | Leak | Evidence |
| --- | --- | --- |
| F1 | **Landing has no web signup CTA.** Above the fold: store badges, "Log in", and "Get app" (scrolls to badges). A desktop visitor cannot install a phone app from a badge and is offered nothing else. Pricing CTA also scrolls to badges. | `frontend/src/components/landing/Welcome.tsx:15-23,77`, `home/HeroSection.tsx:24` |
| F2 | **Web referral links are broken.** The share link is `/welcome?ref=CODE`; `/welcome` is `<Navigate to="/" replace />`, which drops the query string, so `Welcome.tsx:31` never sees `ref`. | `profile/ReferralLink.tsx:19`, `AppRoutes.tsx:184` |
| F3 | Public lesson CTAs are bare `/register` — no `?next=`, so the reader loses the lesson they were in. On a phone they're pushed to web signup instead of the store. | `components/learn/PublicLesson.tsx:179-193,306,425` |
| F4 | No store attribution: badges carry no App Store campaign token (`pt`/`ct`) or Play `referrer`, so App Store Connect can't show "web referrer" installs. | landing badges |
| F5 | No UTM/referrer captured on the user; no GA4 `sign_up` event (only tool events). | `finance/views.py:919` strips UTMs; GA4 config `index.html:141-201` |
| F6 | No email capture for non-signups; no QR code for desktop → phone. | grep |
| F7 | Web social login is Google only (no Apple). | `auth/Register.tsx:499` |

### 3.4 Stores

| # | Finding |
| --- | --- |
| A1 | Real screenshots missing; live iOS set is 10 raw captures incl. #9 with a personal email. Biggest conversion lever on both stores. |
| A2 | Planned iOS en-GB subtitle "Budget, Invest & Build Wealth" aims at head terms we can't win (see §1). **Revise before pushing** (§4, S2). |
| A3 | No RO iOS locale — zero visibility in the least competitive market we have. |
| A4 | Play en-GB description claims 500+ lessons (truthfulness + policy risk), omits Plus/tools/free tier. Play RO body is the older version. |
| A5 | Ratings: prompt logic is sound (`mobile/src/bootstrap/reviewPrompt.ts`, fires on first lesson/quiz/streak, 30-day cap). The ceiling is volume — 21 users have ever completed a lesson. |
| A6 | Unused free surfaces: iOS **promotional text** (editable without a release), iOS **In-App Events** (appear in search results + Today tab), Play **promotional content / LiveOps**, iOS **Custom Product Pages** (per-campaign landing). |
| A7 | iOS description says "175 lessons"; canonical copy says "150+". Minor. |

### 3.5 Off-site + AI search (GEO)

- AI assistants and Google cite NerdWallet-class listicles, credit-union pages, Product Hunt,
  Indie Hackers, university money pages and YouTube. **Garzoni appears in none.** Zogo's lead is
  pure off-site (Techstars, dozens of credit unions, press) — not on-page quality.
- Entity is ambiguous: Wikidata has Giovanna Garzoni, the Garzoni family, a real-estate group —
  no item for the app.
- `docs/geo-offsite-kit.md` errors: **LinkedIn `company/garzoni` is a Swiss construction firm**
  (Garzoni SA, 2.5k followers); **TikTok `@garzoni.app` doesn't exist** but is listed in
  `llms.txt` and the kit.
- Not on Product Hunt, SaaSHub, Indie Hackers, BetaList, AlternativeTo (UNVERIFIED — 403), Crunchbase.
- `robots.txt` allows every AI crawler explicitly; `llms.txt` is good but carries no facts (lesson
  count, languages, £ prices, founder, Romania) and lists the dead TikTok handle.
- Romanian search for adult financial-education apps returns kids/school programmes (Școala de
  Bani/BCR, BNR/ASF) and press (Forbes.ro, Capital.ro, Profit.ro, Edupedu). The niche is empty.

---

## 4. The plan

Owner: **[C]** = Claude can do in the repo · **[A]** = Andrei only (console, money, identity,
off-site) · **[A+C]** = Claude prepares, Andrei publishes.

### Phase 0 — Measure (day 1, ~2h) — nothing below is judgeable without it

| # | Action | Owner |
| --- | --- | --- |
| M1 | Enable Vercel Web Analytics on the `garzoni` project (cookieless, so it counts the visitors GA4's consent gate drops) and add `@vercel/analytics` to the web bundle. | [A] toggle · [C] code |
| M2 | Confirm Google Search Console **and** Bing Webmaster Tools domain properties; submit the sitemap in both; export GSC Pages + Performance (28 days) as the baseline. Bing can import from GSC in one click. | [A] |
| M3 | Store attribution: App Store badge links get `?pt=<provider id>&ct=web_<placement>`; Play links get `&referrer=utm_source%3Dweb%26utm_campaign%3D<placement>`. App Store Connect → Acquisition then shows web-driven installs. | [C] (needs provider id from [A]) |
| M4 | Capture first-touch `utm_*` + `document.referrer` + landing path in `localStorage` on web, send at register, store on `UserProfile`; fire GA4 `sign_up`. | [C] backend + web |
| M5 | Monthly AI-visibility check: 10 fixed prompts (§6) in ChatGPT, Perplexity, Gemini, Claude; log mentions in this doc. | [A] or [C] via WebSearch |

### Phase 1 — Stop the leaks (week 1, ~1–2 days of code) — all [C]

| # | Action | Fixes |
| --- | --- | --- |
| L1 | Replace the `/welcome` client route with a `vercel.json` 301 `/welcome → /` that keeps the query string. Fixes broken web referrals and de-indexes the shell page. | F2, W4 |
| L2 | Landing CTAs by device: **desktop** → primary "Start free in your browser" (`/register`) + QR code to the store; **phone** → store badge for that OS (with M3 tokens). Same for the pricing section. | F1, F6 |
| L3 | Public lesson CTAs → `/register?next=/learn/<slug>`, honoured after onboarding; on phones, offer the store badge first. | F3 |
| L4 | Middleware: add `google-inspectiontool`, `googleother`, `claude-user`, `perplexity-user`, `amazonbot`, `ccbot`, `applebot-extended`, `mistralai-user`, `duckassistbot`. | W1 |
| L5 | Real 404s: middleware returns 404 for `/learn/*`, `/guides/*`, `/ro/learn/*`, `/authors/*` paths with no prerendered file (prerender writes a manifest); SPA shell gets `noindex` on its not-found route. | W2 |
| L6 | 13 RO placeholder lessons: exclude any lesson with an untranslated section from `/ro/` prerender + sitemap now; then translate them with the existing gpt-4.1 pipeline (prod-only, never push local RO over prod). | W3 |
| L7 | Sitemap `lastmod` from real `updated_at`; on deploy and on lesson publish, POST changed URLs to IndexNow. | W5 |
| L8 | Unique titles/H1/descriptions for the 3 duplicate pages and 6 short lesson descriptions; drop `AggregateRating` from the homepage schema until there are ≥20 ratings. | W6, W7 |
| L9 | `llms.txt`: remove TikTok, add a facts block (lessons, courses, languages, £ prices, founder, UK+RO focus); fix LinkedIn/TikTok in `docs/geo-offsite-kit.md`. | §3.5 |

### Phase 2 — Store conversion + Romania (weeks 1–3) — critical path is the 1.2.1 release

| # | Action | Owner |
| --- | --- | --- |
| S1 | **12 screenshot captures** (6 per language) per `store-assets/captures/README.md`, clean demo account, then `node store-assets/render.mjs`. I can drive the iOS simulator to take them if you want — say so. | [A] or [C] |
| S2 | **Revise iOS en-GB metadata before pushing.** Title stays `Garzoni: Learn Money & Finance`. Subtitle → `Investing & Budgeting Lessons` (29). Keywords → `personal,financial,literacy,course,quiz,beginner,stocks,crypto,saving,credit,debt,pension,isa` (93; no title/subtitle repeats; `personal`+Finance indexes "personal finance", `financial`+`literacy`, `learn`+`investing`, `budgeting`+`lessons`, `finance`+`quiz`). Keep RO as drafted: `Garzoni: Educație Financiară` / `Buget, investiții și economii`. | [C] edit · [A] approve |
| S3 | Release 1.2.1: rebuild from master (today's builds predate the £ fix), upload, `eas metadata:push` while the version is editable (pushes RO locale, keywords, screenshots, removes the personal-email screenshot). Production submit stays your call. | [A] |
| S4 | **Now, no release needed:** paste Play en-GB description from `docs/aso/store-listing.md` (kills "500+"), refresh the Play RO full description, upload the feature graphic; update iOS promotional text. | [A] |
| S5 | iOS **In-App Event** each month (e.g. "October money challenge: 7 lessons, 7 days") in en-GB and RO — free search-result placement, cheap to make. | [A+C] copy |
| S6 | Optional paid test once S1+S3 land: Apple Search Ads, £5/day, exact match on `financial literacy`, `learn investing`, `money lessons`, `finance quiz`, + RO `educatie financiara`, `investitii`. Install velocity on a keyword is what lifts organic rank on it; RO CPTs should be very low. Stop if CPI > £2. | [A] (money) |
| S7 | After every rating milestone, reply to every review (both stores). | [A] |

### Phase 3 — Content that ranks and converts (weeks 2–6)

| # | Action | Owner |
| --- | --- | --- |
| C1 | **Public calculators** — compound interest, 50/30/20 budget, emergency fund, savings goal, credit-card payoff — at `/calculators/<slug>` in en + ro, prerendered, math in `packages/core`, each ending in "learn the lesson behind this" + signup. Reuses the existing tools; read `docs/dev/tools-principles.md` first. RO terms like `calculator dobanda compusa` are far less contested than EN. | [C] |
| C2 | Make the first lesson of each course public (~+35 pages). Admin toggle, or I can write a dry-run-first management command. | [A] or [C] |
| C3 | RO hub: `/ro` landing, translate the 21 guides to `/ro/guides`, add hreflang. Keep English slugs (changing later costs redirects). | [C] |
| C4 | E-E-A-T: author photo + LinkedIn in `packages/core/src/constants/editorial.ts`; I draft 2–3 real sources per lesson (FCA, MoneyHelper, gov.uk, HMRC, BoE) for your review — never invented; deepen the 4 thinnest comparison/guide pages to 900+ words with real feature tables. | [A] identity · [C] drafts |
| C5 | Per-page OG images (lesson/guide title on brand template) generated at build. | [C] |
| C6 | After 4 weeks of GSC data: cluster the queries with impressions but position 8–30 and write/expand to them. Don't guess keywords before M2 data exists. | [C] |
| C7 | Structural: serve prerendered HTML to all visitors (not UA-sniffed), React mounts over it. Fixes W1/W9 for good, improves LCP. Separate PR, needs a visual check. | [C] |

### Phase 4 — Off-site + AI search (weeks 2–12, ~2h/week, mostly [A])

Ordered by leverage per hour:

1. **Fix the entity basics:** create LinkedIn page at `company/garzoni-app`; claim TikTok or remove it everywhere; same one-liner on every profile (kit §0).
2. **Romanian founder story** — a Romanian solo founder shipping the first gamified adult finance app in Romanian is news there. Pitch Start-up.ro, Forbes.ro, Capital.ro, Profit.ro, Edupedu; post genuinely in r/Romania, r/robursa. [A+C] I draft pitches in RO.
3. **Product Hunt** launch once S1 screenshots exist ("Duolingo for money" angle — PH ranks for `duolingo for finance`), plus Indie Hackers build-in-public post, SaaSHub, AlternativeTo (as alternative to Zogo/Finlingo/Cleo), BetaList.
4. **UK student money pages** — university money-advice pages (.ac.uk) rank for "budgeting app students UK". Email student-money advisers offering the free tier as a resource. [A+C] I draft the email + a one-page resource sheet.
5. **Listicle outreach:** 11fs, startups.co.uk, richify.ai/uk, mwm.ai, nibble-app.com, The Money Couple, Qonto blog. One honest pitch each.
6. **Reddit:** answer questions in r/UKPersonalFinance / r/personalfinance with real help; mention Garzoni only where it is the answer and the sub allows it.
7. **YouTube Shorts** cut from lesson content — the kit's data says YouTube is ~42% of AI citations in this space.
8. **Wikidata** only after ≥2 independent third-party sources exist (items 2–5), else it gets deleted for notability.

### Phase 5 — Keep what we acquire (parallel, from the retention plan)

Ranking signals come from users who stay; 3 weekly actives is the real ceiling on ratings and rank.
Open items still owed: Customer.io automations 20/21 are empty shells, automation 19
(Day 1/Day 2 activation) is a draft, CIO push delivery unverified on device. See
`retention-teardown` report and `docs/notifications/`.

---

## 5. Sequencing

```
Day 1     M1 M2 M3 ─┐
Week 1    L1–L9 (code) · S4 (Play text, promo text) · entity basics
Week 1–2  S1 captures ─► S2 metadata ─► S3 1.2.1 + eas metadata:push (RO live)
Week 2–3  S5 first In-App Event · Product Hunt (needs S1) · RO press pitches
Week 2–6  C1 calculators · C2 public lessons · C3 RO hub · C4 E-E-A-T · C7 render-for-all
Week 6+   C6 GSC-driven content · S6 ASA test · outreach cadence
```

## 6. Targets (90 days, by 2027-01-01) — targets, not forecasts

| KPI | Now | Target |
| --- | --- | --- |
| Signups / week | ~3 | 15 |
| Web signups / week (`signup_platform=web`) | 0 | 5 |
| Web-attributed store installs / month | unmeasured | measured, then ×2 |
| iOS ratings (GB / RO) | 4 / 7 | 25 / 25 |
| RO App Store rank `educatie financiara` | not in top 200 (no RO listing) | top 5 |
| GB App Store `financial literacy` / `learn finance` | #96 / #104 | top 30 |
| GSC indexed pages | UNVERIFIED | ≥150 |
| Referring domains | ~0 | 15 |
| AI prompt mentions (10 prompts × 4 assistants) | 0/40 | 4/40 |

**AI-visibility prompts (M5):** best app to learn personal finance · duolingo for money · best
financial literacy app UK · app to learn investing for beginners · budgeting app for students UK ·
how can I learn about money as a young adult · Zogo alternatives · gamified finance learning app ·
aplicație educație financiară · cum să învăț despre bani.
