# Phase 4 — content & editorial to-do (needs your input)

Companion to [phase-4-content-eeat.md](./phase-4-content-eeat.md). The **code
plumbing** for E-E-A-T shipped (see below); the items here are content/editorial
decisions on YMYL finance material that must not be fabricated — they need real
names, credentials, and citations from you.

## Already shipped in code (this phase)

- **E3 dates:** lesson API now returns a real `updated_at` (newest section edit);
  lessons render "Reviewed and updated {date}" + schema `dateModified`. Guides
  render visible published/updated dates (schema already had them).
- **E2 sources plumbing:** `source_label`/`source_url` per lesson section are now
  exposed by the API, rendered as a "Sources" block, and emitted as schema
  `citation[]`. **They render only once you populate them** (see E2 below).
- **E8:** homepage `og:`/`twitter:` description aligned with the meta description;
  App Store link added to the lesson footer CTA; `llms-full.txt` now a real
  concatenated corpus of all lessons+guides (was serving the SPA shell) and is
  linked from `llms.txt`.

## Needs your input

### E1 — Author attribution (HIGH, YMYL)

Money content with no named, credentialed author is capped at "Low" quality by
Google's QRG regardless of accuracy. Provide, per lesson/guide (or a small pool
of authors/reviewers):

- Real name + role + relevant credentials (e.g. "CFA", "chartered accountant",
  "10 yrs UK personal finance")
- Short bio, photo, LinkedIn/professional URL
  Then we wire: a `/authors/<slug>` bio page, `author` + `reviewedBy` in schema
  (SeoHead already supports `author` on guides; lessons need an author field on the
  model), and a byline on each page. **Do not invent credentials.**

Also add an **editorial-standards page** ("how we research, who reviews, update
cadence, sources policy") linked from the footer — needs your real process.

### E2 — Sources per lesson (HIGH)

The Sources block + schema citations are live but empty. Populate
`LessonSection.source_label` / `source_url` in the admin with 2–3 authoritative
UK references per lesson: **FCA, MoneyHelper, gov.uk, HMRC, Bank of England**.
Only real, verifiable links — the block renders automatically once set.

### E4 — Expand thin lessons (HIGH)

Below the 800–1,200 word quality-gate target (don't pad — add depth):

| Lesson                                                                       | Words |
| ---------------------------------------------------------------------------- | ----- |
| APR vs AER                                                                   | 391   |
| Good vs Bad Debt                                                             | 378   |
| Compound Interest                                                            | 576   |
| Add: a worked table/example, a unique per-lesson FAQ, and the cited sources. |
| This runs through the content pipeline (author_course / apply_lesson_fixes). |

### E5 — About page (MEDIUM)

363 words, anonymous. Raters check About first on YMYL. Add founder/team names,
photos, credentials, company details, mission. Target 500+ words.

### E6 / E7 — De-fingerprint & humanize (MEDIUM)

E1–E4 already break the "scaled content" pattern. Additionally vary examples/data
per lesson, and rewrite the compound-interest lesson (AI-generic: "powerful tool
for building long-term wealth", "significant" ×6) to match the tighter register
of the APR/AER and Debt lessons.

### GEO extras

- **Wikidata:** "Garzoni" collides with the Venetian family + painter Giovanna
  Garzoni. Create/claim a distinct Wikidata entity for the app (disambiguation is
  a strong AI-citation signal).
- **Reddit:** seed authentic mentions in r/personalfinance, r/UKPersonalFinance
  (2nd-highest AI-citation correlation after Wikipedia).

### E8 open decision

- `buymeacoffee.com` link in the footer on a paid-subscription product reads as
  trust dissonance (SXO finding). Left in place — remove if you agree.
