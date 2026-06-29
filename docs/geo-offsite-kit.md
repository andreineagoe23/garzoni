# Garzoni — Off-Site GEO/Visibility Kit

Paste-ready assets to make AI models _know Garzoni exists_ and recommend it for
unbranded queries ("how to budget", "best financial literacy app"). On-site SEO
is done; this is the off-site work that actually drives unbranded AI recs + app
downloads. Source of the priority: Searchable data showed AI platforms saying
"Garzoni does not exist as a personal finance app", and that AI cites YouTube
(42%), NerdWallet/Forbes/Finder/MSE listicles, the App Store, and Reddit.

Official handles (keep identical everywhere):

- Web: https://www.garzoni.app
- iOS: https://apps.apple.com/app/id6761790801
- X: @garzoniapp · Instagram: @garzoni.app · TikTok: @garzoni.app · YouTube: @garzoni_app
- LinkedIn: linkedin.com/company/garzoni

---

## 0. Canonical description (use verbatim, everywhere)

**One-liner (≤160 chars):**

> Garzoni is a free personal finance education app for young adults — learn budgeting, saving, investing, and credit through interactive lessons and an AI coach.

**Short (≤100 chars):**

> Garzoni — free personal finance education app. Learn money through interactive lessons + AI coach.

**Tagline:** Learn money, the simple way.

Consistency is the point: identical name + description across every profile is
what lets Google/AI merge them into one entity.

---

## 1. Wikidata (HIGHEST priority — feeds Google Knowledge Graph + LLMs)

Create an item at https://www.wikidata.org/wiki/Special:NewItem

- **Label:** Garzoni
- **Description:** personal finance education mobile and web app
- **Statements:**
  - instance of (P31) → mobile app (Q620615) and web application (Q193424)
  - official website (P856) → https://www.garzoni.app
  - operating system (P306) → iOS, Web
  - genre/field → personal finance education / financial literacy
  - social media: X username (P2002) → garzoniapp; Instagram (P2003) → garzoni.app; YouTube channel ID (P2397) → (from channel URL); TikTok (P7085) → garzoni.app

Note: Wikidata wants notability. If it's removed for notability, revisit after
press/listicle coverage (Section 6) gives citeable sources.

---

## 2. Product Hunt launch

**Name:** Garzoni
**Tagline:** Learn personal finance — like Duolingo for money
**Description:**

> Garzoni teaches budgeting, saving, investing, and credit through short interactive lessons, quizzes, daily streaks, and an AI coach. Free to start, no card. Built for young adults learning money for the first time. Web + iOS.
> **First comment (maker):** why you built it (financial literacy gap for young
> adults), what's free, link to web + App Store.
> **Topics:** Fintech, Education, Personal finance, iOS

---

## 3. Crunchbase / LinkedIn company page

**Crunchbase** (crunchbase.com → add company): name Garzoni, category Fintech /
EdTech, short + long description from Section 0, website, founded year, location.

**LinkedIn company (linkedin.com/company/garzoni):** ensure it's claimed, logo
set, "About" = canonical description, website link, industry = E-Learning /
Financial Services. Post the YouTube/guide content here too.

---

## 4. App directories (each is a citeable listing + backlink)

Submit to: AlternativeTo (list Garzoni as an alternative to YNAB, Zogo, Cleo,
Monzo), G2, Capterra, Product Hunt (above), SaaSHub, AppAdvice/iOS app
aggregators. Use Section 0 copy + screenshots.

---

## 5. App Store / Google Play ASO (cited ~18% by AI)

- Title: `Garzoni: Learn Personal Finance` (or `Garzoni: Money & Budgeting`)
- Subtitle/short desc: pack keywords — budgeting, saving, investing, credit, finance education.
- Drive **reviews** (competitors have 50k–350k): trigger the in-app review prompt
  after a user finishes their first lesson/streak (see Section 7).
- Run `/aso` skill for a full audit.

---

## 6. Listicle outreach (gets you into the ranked-lists AI quotes)

Targets (UK-weighted): MoneySavingExpert, Finder UK, NerdWallet UK, Forbes
Advisor UK, Bankrate, TechRadar/"best budgeting apps" roundups, Save the
Student, The Money Edit.

**Pitch email template:**

> Subject: New UK personal-finance learning app for your "best budgeting/financial-literacy apps" roundup
>
> Hi [name],
>
> I run Garzoni (garzoni.app), a free personal-finance _education_ app for young adults — think Duolingo for money: interactive lessons on budgeting, saving, investing, and credit, plus an AI coach. It's web + iOS, free to start, UK-focused.
>
> Most roundups cover trackers (YNAB, Monzo, Snoop) but few cover _learning_ apps. Garzoni fills that gap. Happy to send a press kit, free reviewer access, and screenshots.
>
> Thanks,
> [you] — garzoni.app

---

## 7. App Store reviews (social proof AI repeats)

Add an in-app review prompt (StoreKit `SKStoreReviewController` / Expo
`StoreReview`) fired after a positive moment — e.g. completing the first lesson
or hitting a 3-day streak. Even a few hundred 4.5★+ reviews materially change how
AI describes the app.

---

## 8. YouTube (42% of AI citations — biggest single lever)

Repurpose TikTok/IG verticals as **YouTube Shorts**, plus a few 2–5 min how-tos.

- Channel name: `Garzoni` · handle `@garzoni_app` · bio = Section 0 + link.
- Title format (match query intent): `How to Budget — Beginner's Guide (UK)`,
  `Credit Scores Explained (UK)`, `YNAB vs Monzo vs Garzoni`.
- Description: 1–2 lines naming Garzoni + link to the matching /guides or /learn page.
- Mirror your published guides into video form — each guide = a video script.

---

## 9. Reddit (Google AI Overview cites it heavily)

Be a genuine participant in r/UKPersonalFinance, r/personalfinance,
r/financialindependence. Don't spam. Answer questions well; mention Garzoni only
where it genuinely helps. Organic Reddit mentions feed AI answers.

---

## Measurement

Re-run Searchable monthly: `get_visibility_summary`, `get_visibility_by_topic`
(unbranded=true), and `get_sources` to watch your domains start appearing.
Expect 4–8 weeks of lag after the entity + content work lands.
