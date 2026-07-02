# Phase 5 — growth to-do (needs your input / off-repo work)

Companion to [phase-5-growth-content.md](./phase-5-growth-content.md). The
**pages + schema shipped in code** (see that file's "Shipped in code" block).
The items here are outreach, off-site, and editorial decisions the codebase
can't do on its own.

## Blocks the code content from punching its weight

### Named author (Phase 4 E1 — still open, highest leverage)
Every roundup + alternatives page ships as `Garzoni Team`. Best-of listicles on
YMYL finance queries are graded against NerdWallet/CNBC/Forbes-class bylines;
without a real, credentialed author they're capped at "Low" quality regardless
of how honest they are. Provide a real name + credentials + bio + photo +
LinkedIn (see phase-4-content-todo.md E1), then re-run `seed_growth_guides`
after flipping `AUTHOR`, and wire `/authors/<slug>` + `reviewedBy` schema.

## G5 — Listicle outreach (authority gap, off-site)
Zero presence in ~12 listicles ranking across the 5 download-intent queries.
This is *why* Zogo's homepage ranks and Garzoni's doesn't — it's a link/mention
gap, not an on-page gap. Pitch inclusion to: **The Money Couple, Qonto blog,
KidVestors, Finaciti**. Track referring domains as the leading indicator.

## GEO / entity (off-site, from Phase 4)
- **Wikidata:** "Garzoni" collides with the Venetian family + painter Giovanna
  Garzoni. Create/claim a distinct entity for the app — strong AI-citation
  disambiguation signal.
- **Reddit:** seed authentic mentions in r/personalfinance,
  r/UKPersonalFinance (2nd-highest AI-citation correlation after Wikipedia).

## G6 — Homepage persona fixes (partly shipped)
Done in code: "beta users" → "Learners"; hero H2 → question form + "Duolingo
for finance". Still to do (needs design/assets):
- **Trust is the weakest dimension** (avg 13.5/25). Add a real `<img>` screenshot
  strip above the fold (page has 2 images total today) + testimonials.
- **Budget-fixer persona (51):** surface the budget-builder earlier than the 3rd
  feature card.
- **Broke-student persona (71):** surface the free tier harder above the fold
  (now partly covered by the `/guides/best-money-app-for-students` page).
- **Android dead end:** zero `play.google.com` in the DOM. Until Play is live
  (Phase 2), add an explicit "Android: use the web app" CTA; add the Play badge
  above the fold once live.

## Verify after publish (no re-audit needed)
- GSC impressions: "duolingo for finance", "financial literacy app",
  "zogo alternatives", "best budgeting apps for beginners".
- Rich Results / Search Console: ItemList + FAQ valid on the new roundup pages.
- Searchable visibility on download-intent prompts.
- Referring domains from pitched listicles (G5).
