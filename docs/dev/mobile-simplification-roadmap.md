# Mobile Simplification Roadmap (Deferred Phases)

This document records the **larger simplification bets** for the Garzoni mobile app that are
intentionally _not_ built in the first "quick wins" pass. The quick-wins pass covered:
Home collapse (one hero + minimal status), plain-language money-first Tools, one default Learn
view, and a copy audit — all reversible, config/copy-level, no backend changes.

The phases below need design, backend work, and/or user research. They are recorded here so they
aren't lost. Sequence is a suggestion, not a commitment.

---

## Background — verified problems

A codebase audit (verified against source) confirmed the mobile app overwhelms users because of:

1. **Home stacks ~7 competing decision surfaces** — `mobile/app/(tabs)/index.tsx`: questionnaire
   banner OR resume row, weak-skills (2 CTAs each), a full-month heatmap, a 6-tile KPI grid, an AI
   smart-resume nudge, and PrimaryCTA.
2. **Tools sprawl** — `mobile/src/components/tools/mobileToolsRegistry.ts`: 10 tools in 4 abstract
   groups. Personal CFO is itself a 6-step wrapper (goals→savings→budget→portfolio→market→next-steps).
   `docs/dev/tools-principles.md` says "six defined" while the registry has 10 — scope creep by the
   project's own rule.
3. **Learn is two products** — All-Topics vs Personalized-Path, and inside that Journey vs List:
   four mental models before opening a lesson.
4. **Paywall before value** — `mobile/app/index.tsx:183` redirects `not_chosen` to subscriptions
   before the user reaches any tab / first win.

Default archetype chosen for mobile: **Learner** (optimize the daily loop, keep current positioning).

---

## Phase 3 — Finance tools consolidation (4–6 weeks)

Goal: fewer, clearer money tools; align the registry back toward tools-principles.md's "six".

- Merge **Goals Reality Check + Savings Goals** into one "Savings goal" flow (name, target,
  monthly contribution → projection). Drop duplicate income/expense ranges unless the user opts
  into a "detailed check".
- **Budget:** 3-step guided wizard (income → top 3 categories → done) on first visit instead of
  full envelope CRUD.
- **Portfolio:** progressive disclosure — start with "add one holding" + allocation insight; hide
  AI sheets / export until 2+ holdings.
- **Personal CFO:** decide its fate — either (A) make it the only Tools home with 3 cards, or
  (B) demote from a top-level tile to an onboarding checklist inside the Money group.
- Persistent "not a bank app" expectation-setting on the Money tab + onboarding.
- Plus gates: show locked tools with a preview + one benefit line, not an abrupt sheet.

Principle (from `docs/dev/tools-principles.md`): every tool → one insight + one next action
(lesson link or single CTA).

## Phase 4 — Learn / Exercises streamlining (4–6 weeks)

- **Exercises** (`mobile/app/(tabs)/exercises.tsx`, ~1,472 lines): land in the review queue if due,
  else one recommended drill — not the full catalog.
- Hide the category/type filters behind "Browse all exercises".
- Ensure lesson exit always returns to a clear "what's next" on Home.

## Phase 5 — Progress / engagement hub (2–4 weeks)

- One scrollable screen combining **Missions + Rewards + Leaderboard** (today scattered across the
  Account menu, Profile, and a Home KPI tile).
- Surface 1 daily + 1 weekly mission prominently; the rest under "More".
- Keep **Duels** power-user-only (reachable from Leaderboard / friend profiles); do not add a tab.

## Phase 6 — Onboarding v2 (2–3 weeks)

Flow: value screen → intent picker (Learn / Plan money / Both) → questionnaire trimmed by intent →
first win (5-min lesson OR 2-min reality check) → soft (non-blocking) upsell.

Requires reconciling the **double onboarding gate**:

- Root funnel: `mobile/app/index.tsx:178-186` (needs_onboarding → `/onboarding`; not_chosen →
  `/subscriptions?onboarding=true`).
- Free-user re-force on the dashboard: `mobile/app/(tabs)/index.tsx:440-449`
  (`if (hasPlusAccess) return;` then redirect incomplete questionnaire users to `/onboarding`).
- Defer the paywall (`mobile/app/index.tsx:183`) so users reach a first win before `not_chosen`
  blocks the tabs.

---

## Smaller items (could be pulled forward)

- **Discoverability gaps:** Scan (`/scan`) and Voice-chat (`/voice-chat`) are marketed Pro features
  with no nav entry point. Either add an entry (e.g. from the Money/Tools tab) or drop them from Pro
  marketing until linked.

## Explicitly not now (per tools-principles.md)

- No bank linking.
- No new tools.
- No Personal CFO v2 features until the existing 10 tools are consolidated.

---

## Success metrics (segment by onboarding intent once Phase 6 ships)

| Metric                                              | Direction                                    |
| --------------------------------------------------- | -------------------------------------------- |
| D1 retention                                        | up                                           |
| % reaching lesson-complete in first session         | up                                           |
| Home time-before-first-tap                          | down (faster decision)                       |
| Tools hub → tool-open rate (Money tools)            | up                                           |
| Support tickets mentioning "confusing/overwhelming" | down                                         |
| Subscription conversion                             | monitor (may rise if value precedes paywall) |
