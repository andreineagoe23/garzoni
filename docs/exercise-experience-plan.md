# Exercise Experience Plan

This document outlines the target state for the Exercise page: a small set of perfected formats, a consistent UX rhythm, and the supporting systems that make them feel "Duolingo-level" and better.

## Core Formats (3)

### Multiple Choice (MCQ)
- Supports single answer, optional image/stem, and rationale.
- Smart distractors tied to common misconceptions (e.g., APR vs AER, simple vs compound, nominal vs effective).
- Instant, specific feedback such as: "You treated APR as monthly, not annual."

### Numeric / Formula Input
- Tolerance bands and step validation (units %, years, months).
- Error diagnosis: off by compounding, wrong period, rounding early, wrong base.
- Inline calculator + scratchpad; optional "show formula" reveal.

### Budget Table (micro-spreadsheet)
- One simple grid: income, categories, targets (e.g., savings ≥ 20%).
- Live validation rules: must sum to income, min/max per category.
- Tiny “what-if” sparkline showing savings or debt payoff time as the user adjusts.

## UX Flow (Golden Path)
- Prompt area: big, readable, optional image/chart.
- Work area: component for MCQ / Numeric / Budget.
- Assist bar: Hint, Scratchpad, Calculator, Report issue.
- Submit → Feedback → Explanation → Next in a single, consistent rhythm.
- Session HUD: progress, XP, streak/lives, small mastery meter.
- Keyboard & a11y: full tab/arrow navigation, Enter to submit, ESC to close hints; ARIA live regions for feedback; high-contrast toggle.

## Feedback System
- Tiered hints: Nudge → Example → Full solution, each costing a small amount of XP.
- Error-aware messages (especially for Numeric): detect compound vs simple interest, wrong period (annual vs monthly), rounding too early, misplaced decimals/percent conversion.
- Mini-explanation card after submit: "What to remember" in 2–3 lines.
- "Try a Variant" button loads a parameter-tweaked version for mastery.

## Personalization
- Difficulty seeded from onboarding questionnaire (beginner/intermediate/advanced).
- Optional pre-submit confidence slider; low confidence schedules sooner in review.
- Adaptive next step: if a user misses compounding twice, surface another Numeric on compounding before moving on.

## Integration with Monevo Systems
- Missions/Streak/XP: correct attempts add XP, first-try bonus, hint usage reduces XP; mission counters tick from attempts.
- Leaderboard micro-toast after session end: e.g., "+2 places this hour."
- Savings Simulator nudge: when a Budget task hits the savings target, offer to send it to the Simulated Savings account.
- Review tab: spaced-repetition queue (only for these 3 formats). Daily "Due today" count.

## Minimal Model & API
- **Exercise**: type `mcq|numeric|budget`, data JSON, difficulty 1–5, skills[], version.
- **Attempt**: user, exercise, is_correct, score, time_ms, hints_used, answer_json, exercise_version.
- **Mastery**: user, skill, proficiency 0–100, due_at.

Endpoints:
- `GET /api/lessons/:id/exercises` → ordered list (ids, type, prompt payload).
- `POST /api/attempts` → body: exercise_id, answer; returns `{correct, feedback, explanation, xp_delta, mastery_delta}`.
- `GET /api/review-queue` → due exercises (mix of 3 formats).
- (Optional) `POST /api/next` → returns next recommended exercise id in lesson/session.

Contract expectations:
- Exercises are immutable once published; use a version field, and attempts store exercise_version for audit.
- Server validates data per type; frontend trusts but verifies.

## Frontend Architecture
- `<ExerciseEngine />` state machine: idle → answering → feedback → explained → next.
- Renderer registry maps `mcq|numeric|budget` to components; lazy-load each.
- Attempts store: optimistic submit, reconcile server feedback, emit XP/streak events.
- Assist Panel: calculator (basic ops, ^, %, PMT), scratchpad (plain text), hints modal.

## Quality Bars
- 60 FPS interactions on the budget grid with no noticeable lag on keypress.
- Mobile-first layouts: MCQ large tap targets; numeric keypad; budget grid vertical stack on small screens.
- Full keyboard accessibility and screen-reader labels.
- Error messages never exceed two short sentences.

## Acceptance Criteria

### MCQ
- Arrow keys navigate; Space/Enter selects.
- On wrong answer, feedback names the misconception (if detected) and shows rationale in ≤3 lines.
- "Try variant" loads a new MCQ from the same skill pool in <300ms perceived time.

### Numeric
- Accepts integers/decimals; understands % and unit suffixes (y, mo, £).
- Detects and labels common error classes: compound/simple, period mismatch, early rounding, percent/base mistakes.
- Built-in calculator never steals focus from input; copy result into the field with one click.

### Budget
- Realtime total and validation; savings target turns the goal chip green when met.
- One small sparkline updates as sliders/inputs change with no jank.
- Autocomplete for categories (Rent, Food, Transport…) but fully editable.

### General
- Submit, see feedback, and move on in one consistent animation.
- Hints animate in/out, track usage, and decrement XP accordingly.
- Session summary shows XP gained, skills advanced, next recommended action, and leaderboard delta.

## Content Authoring
- Schema-validated forms per type with preview matching the learner view.
- Misconception tags per MCQ choice and Numeric error patterns to drive feedback copy.
- Parameterized templates for Numeric/Budget so variants generate automatically.

## Analytics
- Track time-to-correct, hint usage rate, first-try accuracy, and drop-off step.
- Per-skill mastery trend; flag items with low discrimination (many guesses right/wrong).
- Heatmap for Budget inputs showing where learners over/under-allocate most.
