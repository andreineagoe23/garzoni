# Growth audit and operating plan (2026-11-16)

**Status:** CURRENT PLAN. Supersedes the priority order in `growth-audit-2026-10.md`; that doc
stays as the reference for the SEO/ASO detail and the work already shipped.

**Method:** read-only queries against the production database, Customer.io workspace 215084,
both live store listings, the live site as a browser and as each crawler, and web search for
off-site mentions. Everything is measured on 2026-11-16 unless marked UNVERIFIED.

---

## 1. The short version

1. **The accounts are real people.** They look fake because they sign in with Google or Apple
   (auto-generated username, no password, sometimes a private-relay address), stay about two
   minutes, and never come back.
2. **Two bugs in the live app waste almost every install.** The first course marks itself 100%
   complete after one lesson, and nobody who installed since 1.2.0 has ever been asked for
   notification permission. Both are fixable this week.
3. **Customer.io is wired correctly and cannot bring anyone back.** It can reach 56 people by
   push, its re-engagement segments contain everyone, and the welcome email has had zero human
   opens.
4. **Acquisition has decayed, not grown.** Signups fell from 3 a week to 2. Every tracked App
   Store rank is worse than six weeks ago. Nothing has shipped to either store since 25
   September.
5. **There has never been a real paying customer.** The two "paying" rows are a staff account
   and a 2025 test account.
6. **Last plan's code shipped; its owner-side half did not.** The Romanian App Store listing,
   Play screenshots, Search Console baseline, In-App Event, press pitches and directory
   listings are all still open. The plan below is built around that constraint.

The order that follows from this: **fix the first session → make the comeback loop work → then
buy and earn traffic.** Sending more people into the current first session would waste them.

---

## 2. Where we are

| Metric                             | 2026-10-02                  | 2026-11-16                                         | Source                              |
| ---------------------------------- | --------------------------- | -------------------------------------------------- | ----------------------------------- |
| Users, all time                    | 115                         | 129 (2 staff, 2 Google test robots)                | prod DB                             |
| Signups / week                     | median 3                    | **median 2.5; 14 in the last 6 weeks**             | prod DB                             |
| Signups by platform, last 20 weeks | iOS 46 · Android 10 · web 0 | iOS 63 · Android 16 · **web 0**                    | `signup_platform`                   |
| Weekly active users                | 3                           | 2–5, of which 1–2 are returning                    | funnel events + section completions |
| Median first session               | not measured                | **2.1 minutes** (p75 6.7)                          | first to last event on signup day   |
| Ever came back after day 0         | not measured                | **13 of 66 (20%)**                                 | cohort joined 1 Jul – 19 Oct        |
| Active after day 7 / day 28        | not measured                | 9 of 66 (14%) / 4 of 66 (6%)                       | same cohort                         |
| Real paying customers              | "1 active, 1 trialing"      | **0** (see §3.5)                                   | prod DB                             |
| Push tokens, signups since 26 Sep  | n/a                         | **0 of 17**                                        | `expo_push_token`                   |
| iOS ratings GB / RO / US           | 4 / 7 / 0                   | 4 / 8 / 0                                          | iTunes lookup                       |
| Play installs / ratings            | 10+ / none                  | 10+ / none                                         | Play page                           |
| GB rank `finance learning`         | #25                         | #97                                                | iTunes search API                   |
| GB rank `money lessons`            | #51                         | #140                                               | same                                |
| GB rank `financial literacy`       | #96                         | not in results                                     | same                                |
| GB rank `learn finance`            | #104                        | #143                                               | same                                |
| RO rank, any non-brand term        | none                        | none (no Romanian iOS listing live)                | same                                |
| Store release                      | 1.2.0 (25 Sep)              | **1.2.0 — no release in 7 weeks**                  | both stores                         |
| Public pages in sitemap            | 100                         | 193                                                | sitemap.xml                         |
| garzoni.app in search results      | brand only                  | **not found for any query, brand or not**          | web search                          |
| Off-site and AI mentions           | 0                           | 0 of 12 prompts                                    | web search                          |
| Web traffic                        | unmeasured                  | UNVERIFIED — the analytics API returns "not found" | Vercel                              |

Ranks are positions in the iTunes search API list, measured the same way both times. They are
a proxy for store rank, good for direction, not exact.

Users are spread across the world, not the UK or Romania. Of the 16 profiles with a timezone:
5 North America, 6 Europe outside the UK, 4 Asia, 1 London, 0 Romania. The other 113 have no
timezone, because it is only captured when push is granted (§3.2).

---

## 3. What is broken

### 3.1 The first course completes itself after one lesson — product bug, live

**What users get:** they finish onboarding, tap through the nine screens of lesson 1, and two
seconds later the whole five-lesson course is marked complete: 45 sections, 5 lessons, the
course-complete reward and celebration. They have seen one lesson of five.

**Evidence:** 12 of the 51 real signups in the last 120 days have exactly this trace: 9
sections of lesson 103 completed by hand, then 36 sections of lessons 104–107 written at
100 ms intervals, then `course_first_complete`. That is most of the people who finished a
first lesson at all. In October, 209 of 281 section completions (74%) were bulk writes.

**Cause:**

- `Lesson` has no `Meta.ordering` (`backend/education/models.py:98`) and `LessonViewSet` uses
  `Lesson.objects.all()` unordered (`backend/education/views.py:321`). Postgres returns course
  22's lessons as 107, 105, 104, 106, 103, so the real first lesson is last.
- Onboarding deep-links to the first lesson (`mobile/app/onboarding.tsx:305`). The flow jumps
  to it, and since it is the last item, finishing it fires `finishCourse`
  (`mobile/src/lesson/LessonFlowScreen.tsx:438-447`).
- `complete_course` then marks every published section in the course complete
  (`backend/education/views.py:1921`).

**Side effects:** anyone who enters a course without the deep link gets the lessons in
scrambled order, starting with the final review lesson. The web flow reads the same endpoint.
"Lessons completed" in every earlier report is inflated by this.

**Fix:** backend only, no app release. Order the lesson queryset (and add `Meta.ordering`),
and make `complete_course` refuse when the caller has not reached the remaining sections.
Add a test that pins lesson order for a course whose rows were inserted out of order.

### 3.2 Nobody has been asked for push permission since 1.2.0

**Evidence:** `push_prompt_shown` fired 12–15 times a month in August and September with about
half accepting. The last one is 25 September. 1.2.0 reached the stores on 26 September. Zero of
the 17 signups since then have a push token.

**Cause:** commit `da188526` moved the ask from onboarding to "after the first completed
lesson", which is the right idea. But the flag it sets is only read in the root route
(`mobile/app/index.tsx:52-60, 261`), so the prompt appears on the _next cold start_. Most
users never have one.

**What it takes down with it:** the device-local streak reminder (needs the same permission),
every Customer.io push, and timezone capture.

**Fix:** show the priming screen inside the lesson flow, right after the first-lesson
celebration. It is a JS-only change, so it can go out as an OTA update to 1.2.0 (publish from
the store commit, not master).

### 3.3 The first session is two minutes long

Median 72 seconds from signup to first lesson, which is good. Then lesson 1's nine screens are
tapped at one to three seconds each, and the session ends. Nobody is reading. This is the real
product problem under the two bugs, and no amount of traffic fixes it.

Onboarding itself is not the leak: since August, 95% finish the questionnaire and 85–95% start
a lesson.

### 3.4 Customer.io: healthy pipes, no audience

What works: events arrive (latest 16 Nov), SPF/DKIM/DMARC verified and confirmed in DNS,
APNs and FCM configured, automations 19, 20 and 21 are now built and running, and the August
private-relay bounce problem is gone (0 bounces in 90 days).

What does not:

| Problem                               | Evidence                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-engagement segments match everyone | "Inactive 3+/7+/14+/30+ days" hold 455 / 454 / 404 / 396 of 455 people. They key off `app_opened`, which only the 1.2.0 SDK emits. Campaigns 9–12 therefore start 330–390 journeys each and collide with the 1-email-a-day cap (16 of 20 "undeliverable" emails were cap blocks).                    |
| Almost nobody is reachable            | 56 people have a device, and 40 of 66 devices were last used over 60 days ago. No new devices can arrive (§3.2). 323 of 455 profiles have no email — the database has only 129 users, so these are anonymous device or visitor profiles. Two creation spikes (152 and 114 in a week) are UNVERIFIED. |
| Nobody engages                        | 90 days: 239 emails delivered, 19 human opens, 3 human clicks, 1 conversion. 238 pushes sent, 47 confirmed delivered, 0 opens. iOS push delivery over the last 7 days: 0%.                                                                                                                           |
| Welcome email is invisible            | 0 human opens of 42 delivered — the same as August.                                                                                                                                                                                                                                                  |
| Dead automations                      | Weekly Digest: 0 starts in 90 days. Streak Milestone: 1 start; the event last fired on 27 August.                                                                                                                                                                                                    |
| No language attribute                 | Romanian users cannot be segmented.                                                                                                                                                                                                                                                                  |

### 3.5 Revenue is zero

The "active Pro" row is a staff account. The "trialing Pro" row joined in March 2025 and its
trial ended in May 2026. `core_userpurchase` and `core_stripepayment` are empty.

Since September about 30 people saw the paywall. There were 10 upgrade taps, all cancelled at
the store sheet, in bursts across several packages within seconds — the pattern of one person
comparing prices or testing. Nobody has started a trial.

This is not yet a pricing finding. With two-minute sessions, nobody has reached a reason to pay.

### 3.6 Stores

- No release since 25 September on either store. 1.2.2 sits on TestFlight and Play internal.
- The Romanian iOS listing, the new en-GB subtitle and keywords, and the removal of the raw
  screenshots (including the one showing a personal email) are all still local in
  `mobile/store.config.json`. iOS metadata only changes with a version.
- Play has no en-US listing, no ratings, and "10+" installs. Play screenshots and feature
  graphic upload are UNVERIFIED (still open on the October checklist).
- Play says "150+ lessons"; live iOS says 175.
- `financial literacy` in GB is nearly uncontested: the top five apps have 8 ratings between
  them. `educatie financiara` in RO: top five have 53. Both are winnable with a matching title
  and a handful of ratings. Neither needs a bigger product.

### 3.7 Web

- 193 pages are live, prerendered, canonical and readable by every AI crawler. That work held.
- No page was found in search for any query, including the brand name. Whether Google has
  indexed them is UNVERIFIED: Search Console was never re-baselined (item M2, open since
  3 October).
- Zero referring domains, zero directory listings, zero press. On a new domain this is the
  binding constraint, not page count.
- Still zero web signups. Since 3 October the web register page was viewed 9 times.
- Sitemap `lastmod` has nothing newer than 2026-07-05 even though 90 pages were added in
  October.
- `/` and `/ro` return an empty shell to anything not on the bot list (link previewers, Bing
  UNVERIFIED).

### 3.8 The pattern across both audits

Everything that could be done in the repo was done within a week. Everything that needed a
console, an inbox or a send button is still open six weeks later. That is not a criticism,
it is the design constraint: **this plan gives the owner one fixed weekly slot with a short,
ordered list, and moves everything else into code or automation.**

---

## 4. Strategy

"Top of the App Store" is not one ranking. Rank is per keyword, per country, and it is driven
by install velocity, page conversion, retention and rating count. Metadata only makes the app
eligible. So the plan is to win small, uncontested keywords first and widen from there.

Three engines can run without daily posting:

1. **Store search** in pockets nobody defends: Romanian, the education long-tail in English,
   and a US listing (where the users actually are).
2. **The website** as a compounding source: calculators and lessons that rank, once the domain
   has links and proven indexation.
3. **The product itself**: ratings prompts, referral, shareable results. This only works when
   users stay.

**The volume problem.** At two signups a week, no change can be measured: a retention
experiment would take months to read. There is no ad budget (decided 2026-11-16), so the
learning traffic comes from the one channel that has worked: three TikToks a week. Apple Search
Ads stays the option to revisit once there is revenue.

**What to stop:**

- New features. The codebase is about 180k lines serving 4 weekly users. Personal CFO, open
  banking, voice tutor and receipt scan do not affect whether someone opens the app on day 2.
- More keyword rewrites without a release to carry them.
- More web pages before Search Console shows the existing 193 are indexed.
- Buying installs or review swaps.

---

## 5. The plan

Owner: **[C]** Claude, in the repo or via a connected tool · **[A]** Andrei only ·
**[A→C]** Andrei says yes, Claude does it.

### Phase 0 — Stop wasting installs (this week)

| #   | Action                                                                                                                                                                                                                        | Owner      | Ships as       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| 0.1 | Order lessons in the API and model; guard `complete_course`; regression test                                                                                                                                                  | [C] **done 2026-11-19** (`44fa3bfd`) | backend deploy |
| 0.2 | Show the push priming screen in-flow after the first lesson                                                                                                                                                                   | [C] **built 2026-11-19**; OTA not published | OTA to 1.2.0   |
| 0.3 | Capture timezone at signup from the device, not at push grant                                                                                                                                                                 | [C] **backend + web live 2026-11-19**; mobile in OTA | OTA + backend  |
| 0.4 | Rebuild CIO segments 15–18 on `last_active_at`; pause campaigns 9–12 until they are right                                                                                                                                     | [A→C] **done 2026-11-19**; 9–12 stay stopped | Customer.io    |
| 0.5 | Release 1.2.2 to production on both stores, with `eas metadata:push` (Romanian iOS listing, subtitle, keywords, screenshot cleanup). **Play: done 2026-11-16 (vc22 on production).** iOS: metadata push + submit still to do. | [A]        | store release  |
| 0.6 | Open Vercel → Analytics and confirm it is collecting                                                                                                                                                                          | [A] 2 min  | —              |
| 0.7 | Search Console: resubmit the sitemap, export Pages + Performance                                                                                                                                                              | [A] 10 min | —              |
| 0.8 | App Store Connect → Analytics → Sources, by territory, last 90 days. This shows whether installs come from search, browse or web, and from which countries. It is the most useful number we do not have.                      | [A] 10 min | —              |

**Sequence agreed 2026-11-16:** cleanup plan (`cleanup-plan-2026-11.md`) → release 1.2.2 as
built (0.5) → then 0.1–0.4. **2026-11-19:** 0.1 live; 0.2 also uncovered that the section path skipped every lesson-completion side effect (0 of 28 lesson finishers had `first_lesson_at`), fixed in `8777efea`; 0.3 live on backend and web; 0.4 done. 0.2 will need two
OTA updates: one for the 1.2.2 runtime, one from `ota/1.2.0-chat-fix` for anyone still on 1.2.0.

### Phase 1 — A first session worth coming back to (weeks 1–4)

Goal: someone who installs today opens the app tomorrow.

| #   | Action                                                                                                                                                                                    | Owner                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1.1 | `manage.py growth_report`: one command that prints the weekly table in §2 (signups, session length, return rates, push opt-in, bulk-completion count). Run every Monday.                  | [C]                          |
| 1.2 | Log lesson dwell time per section and a `session_start` event, so "tapped through" and "read" can be told apart                                                                           | [C]                          |
| 1.3 | Rework lesson 1 of the default course: a question on screen 2, not screen 9; fewer text-only screens; end on a concrete "tomorrow: lesson 2, 3 minutes" card that arms the local reminder | [C] build · [A] content call |
| 1.4 | Welcome email: plain text, from a person, one line and one link. Send a seed copy to Gmail and iCloud to see which tab it lands in.                                                       | [C] draft · [A] check        |
| 1.5 | Send `language` to Customer.io; fix or retire Weekly Digest and Streak Milestone                                                                                                          | [C]                          |
| 1.6 | Three TikToks a week (Andrei's call, 2026-11-16) with `/get?c=tiktok` in the bio so installs are attributed. This is the learning traffic: no paid spend, so no Apple Search Ads for now. | [A]                          |
| 1.7 | Ask the dozen users who completed five or more real lessons for a rating, personally, by email                                                                                            | [A]                          |

**Gate before Phase 4** (read on at least 40 new users):
came back within 3 days ≥ 25% · push opt-in ≥ 40% of lesson finishers · lesson 1 read rather
than tapped through ≥ 50%.

### Phase 2 — The store engine (weeks 2–8)

| #    | Action                                                                                                                                                                                                                                                                                                                                                                    | Owner                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 2.1  | Release train, every two weeks (§6). Each release carries "What's new" in both languages and one keyword change per storefront.                                                                                                                                                                                                                                           | [C] build · [A] submit  |
| 2.2  | US listing: add en-US on both stores with $ pricing copy. Apple indexes extra locales per storefront, which adds keyword fields; check Apple's current locale table before filling them.                                                                                                                                                                                  | [C] draft · [A] approve |
| 2.3  | Play: upload the five 1080×1920 screenshots and feature graphic already rendered in `store-assets/out/play-from-ios/`; align the lesson count; run a free Store Listing Experiment on the short description                                                                                                                                                               | [A] or [A→C]            |
| 2.4  | One In-App Event a month (media already rendered for the first)                                                                                                                                                                                                                                                                                                           | [A]                     |
| 2.5  | Featuring nomination in App Store Connect for the release that adds Romanian                                                                                                                                                                                                                                                                                              | [A] 15 min              |
| 2.6  | `scripts/growth/ranks.mjs`: weekly rank tracker for the keyword list, appended to a CSV, so §2's rank rows are one command                                                                                                                                                                                                                                                | [C]                     |
| 2.7  | Reply to every review on both stores                                                                                                                                                                                                                                                                                                                                      | [A]                     |
| 2.8  | **Creative assets** (App Store Connect, live since 2026-10-05): new images/video for the product page header and for search results, managed in the Asset Library with a live preview. Free conversion lever nobody in our keyword pockets uses yet. Read Apple's "Creative assets specifications" first, then build one header and one search-result asset per language. | [C] render · [A] upload |
| 2.9  | **iPhone Duo screenshots** (outer 1398×2034, inner 2007×2853). Optional now and adds a "made for iPhone Duo" badge; required from April 2027 for apps on the iOS 27.1 SDK or later. Check the app's layout on the inner display before claiming it.                                                                                                                       | [C] render · [A] upload |
| 2.10 | Screenshot slots: Apple now names "iPhone with Dynamic Island (medium display)" (1206×2622 or 1179×2556) as the required iPhone set. Ours are 1290×2796 (large). If App Store Connect blocks a submission on this, resize the five designed shots.                                                                                                                        | [C] if needed           |
| 2.11 | Age rating: answer the new questionnaire items (social media capabilities, added 2026-07-09) in App Store Connect. EAS Metadata cannot write the new 16+ value, so the `advisory` block stays out of `store.config.json`; age rating is managed in App Store Connect only.                                                                                                | [A] 5 min               |

### Phase 3 — The web engine (weeks 3–16)

Nothing here starts until 0.7 shows how many of the 193 pages are indexed.

| #   | Action                                                                                                                                                                                                                                                                                                                             | Owner            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 3.1 | Links first. Two submissions a week from the weekly slot: Product Hunt, AlternativeTo, SaaSHub, BetaList, Indie Hackers, Crunchbase. Then the Romanian founder-story pitches and UK university adviser emails, already drafted in `docs/promo/outreach-and-events-2026-10.md`. These are one-off submissions, not a posting habit. | [A] · [C] drafts |
| 3.2 | Run the approved Romanian guide translation (command in the carried-over section at the end, C3b)                                                                                                                                                                                                                                  | [A]              |
| 3.3 | Sitemap `lastmod` from the real publish date; serve the prerendered `/` and `/ro` to everyone                                                                                                                                                                                                                                      | [C]              |
| 3.4 | A public "test your money knowledge" quiz: ten questions, no signup, a shareable score card, then "learn what you missed" into signup. It is a link target, a search page and a share loop in one.                                                                                                                                 | [C]              |
| 3.5 | Romanian calculators chosen from Search Console and keyword data, not guesses. Candidates to validate: government bond (Tezaur/Fidelis) return, deposit interest, loan repayment.                                                                                                                                                  | [C] after data   |
| 3.6 | Embeddable calculator widget with a credit link                                                                                                                                                                                                                                                                                    | [C]              |
| 3.7 | From week 6 of Search Console data: expand whatever sits at positions 8–30                                                                                                                                                                                                                                                         | [C]              |

### Phase 4 — Loops and money (from week 8, only if the Phase 1 gate holds)

| #   | Action                                                                                                                   | Owner                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 4.1 | Referral that gives both sides something real (a month of Plus). `core_referral` has zero rows today.                    | [C]                     |
| 4.2 | Share cards on real course completion and streak milestones, deep-linked to the public quiz                              | [C]                     |
| 4.3 | Paywall: one paid tier, annual with a 7-day trial, shown after the second lesson or on day 2, local prices for RO and US | [C] build · [A] pricing |
| 4.4 | Streak widget for the iOS home screen                                                                                    | [C]                     |

---

## 6. Operating cadence

| When              | What                                                                                                                                               | Time                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Monday, weekly    | Run `growth_report` and the rank tracker. Do the week's console items (never more than three). Two off-site submissions.                           | 60–90 min [A]          |
| Any day           | JS fixes go out as OTA updates to the live binary                                                                                                  | [C]                    |
| Every second week | Release train: freeze Friday → build → TestFlight and Play internal over the weekend → submit Monday → live midweek with metadata and "What's new" | [C] build · [A] submit |
| Monthly           | In-App Event · AI-visibility re-run · Customer.io review · which TikToks produced installs                                                         | 1 h                    |
| Every 6 weeks     | Re-run this audit's §2 table and re-plan                                                                                                           | [C]                    |

To build once so the cadence is cheap: `growth_report` (1.1), the rank tracker (2.6), and a
GitHub Action that runs the EAS build on a version tag.

---

## 7. Targets for 2027-02-15 — targets, not forecasts

The October audit set 15 signups a week by 1 January. We are at 2.

| KPI                              | Now            | Target                     |
| -------------------------------- | -------------- | -------------------------- |
| Signups / week                   | 2              | 15 (store search + TikTok) |
| Came back within 3 days          | 6 of 66 (9%)   | 25%                        |
| Active after day 7               | 14%            | 25%                        |
| Push opt-in, of lesson finishers | 0%             | 40%                        |
| Bulk-completed courses           | 12 in 120 days | 0                          |
| iOS ratings GB / RO / US         | 4 / 8 / 0      | 20 / 25 / 5                |
| Play ratings                     | 0              | 10                         |
| RO rank `educatie financiara`    | none           | top 5                      |
| GB rank `financial literacy`     | none           | top 20                     |
| Store releases                   | 0 in 7 weeks   | 1 every 2 weeks            |
| Indexed pages (Search Console)   | UNVERIFIED     | ≥ 150                      |
| Referring domains                | 0              | 12                         |
| Paying customers                 | 0              | 5                          |

---

## 8. Not verified

- Web traffic: the analytics API says no data exists. Either the dashboard toggle is off or the
  connector cannot read it.
- Google index count, and Core Web Vitals (PageSpeed quota exhausted).
- Where installs come from. Mobile signups carry no attribution; App Store Connect has it.
- Live iOS subtitle and keyword field (the public API does not expose them).
- Play screenshots, feature graphic, installs and crash numbers (the connector returns stubs).
- Why 323 Customer.io profiles have no email, and what caused the two creation spikes.
- Why confirmed push deliveries fell to 1–3 a week from 3 November.
- Social profile follower counts.

---

## 9. Carried over from the October working checklist

Open items from the retired `GROWTH-PHASES.tmp.md` (2026-10-02 to 2026-10-08) that §5 does not
already cover. IDs refer to `growth-audit-2026-10.md`. Items §5 covers (M2 = 0.7, S3 = 0.5,
S6 = no ad budget, S7 = 2.7, C6 = 3.7, monthly AI-visibility re-run = §6) are not repeated.

| ID          | Open item                                                                                                                                                                                                                                                                                                                                                                                                                                            | Owner                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| S4          | iOS promotional text still to update (Play descriptions were replaced via the Play API on 2026-10-03; the Play feature graphic is in 2.3)                                                                                                                                                                                                                                                                                                            | [A]                     |
| S1b         | Play slot 5 (`store-assets/out/play-from-ios/slot5.jpg`) shows US$59.99/69.99: swap or drop it before uploading (2.3)                                                                                                                                                                                                                                                                                                                                | [A→C]                   |
| S5          | In-App Event copy is in `docs/promo/outreach-and-events-2026-10.md`; media at `store-assets/out/in-app-event/{card,details}.png`; the event itself is not created in App Store Connect (2.4)                                                                                                                                                                                                                                                         | [A]                     |
| C3b         | `translate_articles_to_ro` is built; 8 guides approved. Dry run first, then `railway ssh --service garzoni -- python manage.py translate_articles_to_ro --slugs what-is-garzoni,what-is-an-ai-money-coach,investing-basics-for-beginners,how-to-pay-off-debt,how-to-set-savings-goals,how-to-start-budgeting,best-financial-literacy-apps,duolingo-for-money-best-apps --only-missing` (add `--dry-run`), then rebuild the web app to prerender them | [A]                     |
| C4          | Content accuracy review, now `content-drafts/eeat-drafts-2026-10.md`: 17 factual mismatches in public lessons (FSCS £120k, NI 8%, BNPL regulated, Renters' Rights Act, Emma/Luke maths, LISA, Mint and others), 7 RO tax/banking lessons that describe UK rules, 4 guide expansions. Waiting on Andrei: correction script vs admin edits, whether to hide the 7 UK lessons from `/ro`, author photo and personal LinkedIn                            | [A] decide · [C] script |
| C2          | Rename duplicate-titled first lessons: Technical Analysis Basics x2, the DeFi pair, psychology-of-trading-2                                                                                                                                                                                                                                                                                                                                          | [C]                     |
| Off-site RO | Founder-story pitches to Start-up.ro, Forbes.ro, Capital.ro, Profit.ro, Edupedu; genuine posts on r/Romania and r/robursa. Ranked outreach targets are in `docs/seo/ai-visibility-2026-10.md`                                                                                                                                                                                                                                                        | [A]                     |
| Off-site    | Order after Product Hunt (after S1): Indie Hackers, SaaSHub, AlternativeTo (including creating a Zogo page), BetaList, UK university money advisers, listicle outreach, genuine Reddit answers, YouTube Shorts, Wikidata only after at least 2 third-party sources. About 2 h/week                                                                                                                                                                   | [A]                     |
| Brand SEO   | Bare "garzoni" resolves to the Garzonis (painters) on Wikipedia; entity schema was strengthened (founder, alternateName, knowsAbout). The public GitHub repo outranks the site on one brand query, which is Andrei's call. Baseline the "garzoni" position in Search Console                                                                                                                                                                         | [A]                     |
| Retention   | CIO push verified on a real device (automations 19-21 are running per §3.4, but iOS push delivery was 0% over the last 7 days)                                                                                                                                                                                                                                                                                                                       | [A→C]                   |
| Security    | `pnpm audit --audit-level=high` reported highs on 2026-10-03 (CI uses continue-on-error); fixing touches the lockfile, so it needs an explicit OK. Not re-checked on 2026-11-17                                                                                                                                                                                                                                                                      | [A] OK                  |
