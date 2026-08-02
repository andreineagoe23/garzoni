# Missions — UI/UX + integration audit (2026-08-01)

> **Status 2026-08-02** — the card rework (§6.2) plus §6.1 items 1–3 are implemented and uncommitted:
> compact action rows on both platforms, `packages/core/src/engagement/missionPresentation.ts` as the
> shared source of fractions/CTAs/routes, `clear_review_queue` progress wired to exercise submit, quest
> XP + badge granted on the final step, per-platform quest step routes, and a back control on deep-linked
> tool screens. Still open: §3 (client-authoritative XP endpoints), §6.1 items 4–5, §6.3, §6.4.

Scope: `/missions` on web (`frontend/src/components/engagement/Missions.tsx`), `mobile/app/missions.tsx`,
the shared card components, and the whole backend mission engine (`backend/gamification/`).
Goal: what to fix, what to redesign, and how missions should hook into the rest of the app.

---

## 1. System map (what actually exists)

**Pool + selection**

- 22 seeded missions (`backend/gamification/fixtures/mission_pool.json`): 12 daily, 10 weekly.
  - daily: 5 `add_savings`, 3 `complete_lesson`, 3 `clear_review_queue`, 1 `read_fact`
  - weekly: 3 `add_savings`, 3 `complete_lesson`, 2 `clear_review_queue`, 1 `read_fact`, 1 `complete_path`
- `MISSIONS_LAZY_ASSIGNMENT=True` (default, `backend/settings/settings.py:207`) → picks are computed, not stored:
  `select_cycle_missions()` (`services/mission_cycles.py:185`) seeds `random.Random` on `user-type-cycle`,
  shuffles, then `_diverse_pick()` takes **one mission per goal_type first**.
- Display counts: 4 daily / 4 weekly (`gamification/views.py:83-84`).
- Cycles roll at local midnight / Monday (`services/mission_cycles.py`), rotated by Celery
  (`gamification/tasks.py: reset_daily_missions / reset_weekly_missions`).

**Progress triggers** (the only call sites of `MissionCompletion.update_progress`)

| goal_type | trigger | file |
|---|---|---|
| `complete_lesson` | lesson completion | `education/views.py:1876` |
| `complete_path` | course completion | `education/views.py:1665` |
| `read_fact` | mark fact read | `finance/views.py:1866` |
| `add_savings` | savings deposit | `finance/services/savings.py` |
| `clear_review_queue` | **none** | — |
| `streak_rescue` | client POST only | `gamification/views.py:338` |

**XP flow** — mission XP is granted through `grant_reward()` → `RewardLedgerEntry`, which is exactly what
`services/leaderboards.py` aggregates for the weekly XP leaderboard and leagues. Missions are already the
main lever for league placement; nothing in the missions UI says so.

**Clients**

- Web: `/missions` route + top-level navbar item (`Navbar.tsx:31`). Dashboard shows a non-interactive
  "Active missions" count tile, and a `start_mission` primary CTA (`primaryCtaSelector.ts`).
- Mobile: **no tab**. Reachable only via the account-menu modal (`AccountTabMenuModal.tsx:196`) or the
  home KPI tile (`StatusSummaryGrid.tsx:198`, pressable).

---

## 2. Broken or dead mechanics (P0 — these are bugs, not taste)

**2.1 `clear_review_queue` missions can never progress.**
No code path calls `update_progress` for that goal type. Worse, `_diverse_pick` takes one mission per
goal_type and daily display count is 4 with exactly 4 daily goal types — so **every user, every day, has
exactly one permanently-0% mission on the board**, forever. Same for weekly. That is 25% of the daily board
being visibly broken.
Fix: call `touch_assigned_completions(user, ["clear_review_queue"])` + `update_progress()` from the review/
practice completion path in `education/views.py`, and recompute on GET (the goal is a *state* check —
`Mastery.due_at` count — so it can be evaluated on read).

**2.2 Multi-step quests grant nothing.**
`MultiStepMissionProgress.mark_step_complete` (`models.py:233`) flips status to `completed` and stops.
`points_reward` (200 / 180 XP) and `badge_name` ("Market Ready", "Foundation Builder") are seeded
(`migrations/0013_seed_investor_quests.py`), serialized into the payload (`views.py:294`), and never awarded.
Fix: grant on transition to `completed` via `grant_reward(..., f"multistep_mission:{user_id}:{mission_id}")`
plus `UserBadge` creation.

**2.3 Quest steps carry `route` but neither client uses it.**
Seed steps include `"route": "/exercises?skill=Investing&intentReason=mission_step"` etc. Web
(`Missions.tsx:780-803`) and mobile (`missions.tsx:775-792`) render a static row with a "Done/Next" chip.
The entire narrative-quest feature is a read-only list.

**2.4 Web mission cards have no CTA at all.**
`mobile/src/components/engagement/MissionCard.tsx:97-112` routes `complete_lesson` / `complete_path` →
`/(tabs)/learn?view=personalized` and `clear_review_queue` → `/(tabs)/exercises`.
`frontend/src/components/engagement/MissionCard.tsx` has no equivalent — on web, every lesson/path/review
mission is a dead end. The i18n keys (`missions.cta.*`) already exist.

**2.5 Web offline machinery is vestigial.**
`queueMissionCompletion()` (`packages/core/src/services/offlineQueue.ts:36`) is never called anywhere in the
repo. `Missions.tsx` still runs `syncOfflineQueue` on mount, on `online`, and every 60s, plus renders an
"Offline mode — missions will sync" chip, for a queue that cannot be populated. Delete it or wire it.

**2.6 Weekly `read_fact` mission has no UI to progress it.**
Both cards render `FactCard` only when `isDaily` is true. The weekly "5 facts" mission shows a progress bar
and no way to act on it; if the daily fact mission isn't one of today's picks, there's no fact surface at all.

**2.7 Copy/state bugs.**
- Web `<h1>` is hardcoded `missions.header.title` = "Daily Missions" while the tabs switch to Weekly/Quests.
- Mobile shows a native header "Missions" *and* an in-page H1 "Daily Missions" — double title.
- Mobile summary block always shows *daily* XP numbers even when the Weekly tab is active
  (`missions.tsx:636-684` uses `dailyXpEarned/dailyXpTotal`); web made this scope-aware, mobile didn't.
- `showSavingsMenu` is one boolean for the whole page on both platforms → two savings missions expand
  together.

**2.8 Rotation is an illusion.**
Because `_diverse_pick` fills one slot per goal_type and there are exactly 4 daily goal types, the daily
board is always {lesson, savings, review, fact}. The 12-mission pool only changes the *names*. Users see the
same four verbs every day for the life of the account.

**2.9 The savings mission is the weakest loop on the page and it is 42% of the daily pool.**
`add_savings` is a free-text number typed into a simulated pot (`SimulatedSavingsAccount`) with no
verification of anything. Type `10`, press Add, mission completes, XP granted. Five of twelve daily missions
are this. It teaches nothing and is trivially farmable.

---

## 3. Security-adjacent (flagging, not UI work)

- `POST /missions/` and `/missions/<id>/update/` (`views.py:317-350`) accept a client-supplied `progress`
  increment and pass it straight to `update_progress`, which auto-grants XP at 100%. For `add_savings` and
  `streak_rescue` this is direct client-authoritative XP.
- `POST /missions/complete/` trusts client-declared `first_try`, `attempts`, `hints_used`, `mastery_bonus`
  → self-declared +20% / +15% multipliers, on any mission id.
- The reward ledger prevents *double* awards per (mission, cycle); it does not prevent the first fake one.
- Throttle is 10/min (`MissionCompletionThrottle`).

Same class as the education-viewset finding in the 2026-07 security audit. Recommend: delete the progress
POST endpoints (no client calls them) and make `/missions/complete/` server-verified or admin-only.

---

## 4. UX findings on the page itself

**4.1 It reads as a ledger, not a board.**
Each card is ≥260px tall and carries: title, badge, description, "Why this matters:" sentence, progress
label, bar, progress detail line, plus a "Level-aware target: 3 lessons. Estimated completed today: 1."
footnote. Two-column grid on web, stacked on mobile. Four of these = a wall of prose for what is a four-item
to-do list. Scanning cost is high, action affordance is low.

**4.2 Percentages instead of counts.**
Backend stores progress as a percent, so the UI says "33% of your 3-lesson target". Users think in
"1 of 3 lessons". `goal_reference.required_lessons` / `target_count` / `target` are all in the payload —
render fractions and derive the bar from them.

**4.3 No reset countdown.**
The single strongest urgency lever in a daily-mission system is "resets in 6h 12m". Cycles are well-defined
server-side; the UI never shows time remaining, on either platform.

**4.4 No connection to leagues, despite the plumbing being real.**
Mission XP → ledger → weekly leaderboard/leagues. The card could say "+45 XP → 3rd in Bronze". Today the
completion copy is a generic "Keep the momentum to unlock streak and leaderboard boosts."

**4.5 Five parallel progress systems, no reconciliation.**
Daily missions, daily XP goal (`profile.daily_goal`), streak, weekly league XP, hearts. Home surfaces a raw
"active missions" number; the missions page surfaces "XP earned · XP still on the table"; the Climb map
surfaces course progress. Nothing tells the user which one is *the* daily target.

**4.6 The streak-wager card sits above the missions.**
`StreakWagerCard` renders between the summary and the tabs on both platforms, pushing the actual missions
below the fold. Wagers are a streak mechanic, not a mission.

**4.7 Weak terminal states.**
The all-done "wrap-up" card ends in a `<div>` of text ("Keep going! Weekly missions and reviews will boost
mastery next.") — not a button. Empty state says "New missions appear after the next reset" with no action
(mobile passes `onAction={undefined}` explicitly).

**4.8 Swap is unexplained and, on web, uses `window.confirm`.**
Native browser dialog inside a designed product; also no indication *before* tapping that you get one swap
per day, or what you'll get instead.

**4.9 Quests tab is a hidden third mode.**
Only appears if quests exist, shows no reward, no overall progress bar, no CTAs, and on mobile renders
*above* the loading/error branch so it can appear while the rest of the page is still skeletons.

**4.10 Accessibility.**
Web scope tabs are plain `<button>`s — no `role="tablist"`, `aria-selected`, or arrow-key navigation; no
focus move when the scope changes. Cards use `role="article"`; progressbars are labelled correctly. The
`aria-live` celebration region duplicates the toast.

**4.11 Polling cost.**
Web missions query: `staleTime 30s`, `refetchInterval 30s`, `refetchIntervalInBackground: true` — every open
tab hits `/missions/` twice a minute forever, and the dashboard polls the same key at 120s in background too.
Mobile polls at 60s. Every mission trigger is user-initiated and the mutation responses already return
authoritative deltas (`current_mission_deltas`, `missions_completed_now`) — background polling buys nothing.

---

## 5. Web ↔ mobile parity

| Capability | Mobile | Web |
|---|---|---|
| Per-mission CTA deep link | ✅ | ❌ |
| Mission-complete celebration | ✅ `RewardClaimModal` + haptics | toast only |
| Lesson-flow mission celebration | ✅ (`useLessonFlow` → `missions_completed_now`) | ❌ (only invalidates query) |
| Delta merge from mutations | ✅ `mergeMissionDeltas` | ❌ (guesses with `bumpMissionProgress(+25)`) |
| Skeletons / error state + retry | ✅ | spinner only, no retry |
| Pull to refresh | ✅ | — |
| Fact loading state | ✅ | ❌ |
| Scope-aware summary numbers | ❌ | ✅ |
| Entrance animation | ✅ | ❌ |

Web's `bumpMissionProgress` fabricating "+25%" while the server returns real deltas is the one worth fixing
first — it can show progress that the server disagrees with.

---

## 6. Recommendations

### 6.1 Fix the engine (P0, ~1–2 days)

1. Wire `clear_review_queue` progress (trigger on review/practice completion + recompute on GET).
2. Grant quest `points_reward` + `badge_name` on completion; expose reward in the payload UI.
3. Add web mission CTAs mirroring mobile's route map; make quest steps tappable via their `route`.
4. Delete the dead offline-queue path in `Missions.tsx` (or wire `queueMissionCompletion` for real).
5. Render `FactCard` for weekly `read_fact` too; per-card savings menu state; fix the H1/scope copy bugs;
   make mobile's summary scope-aware.
6. Harden/remove the client-authoritative progress endpoints.

### 6.2 Rebuild the board (P1, ~2–3 days)

- **Header**: "Today" + reset countdown chip + one XP ring that *is* the daily goal (fed by mission XP).
- **Rows, not cards**: one line per mission — icon, name, `1/3 lessons`, XP pill, primary CTA. Expand for
  the "why" sentence on tap. Target ~72px per row instead of 260px.
- **One page, no tabs**: Daily rows → Weekly section → Story quests section. The tab row currently hides
  two thirds of the content behind a control most users won't press.
- **Fractions everywhere**, derived from `goal_reference`.
- **League line** on completion: "+45 XP · you're #3 in Bronze this week".
- **Web claim modal** matching mobile's `RewardClaimModal`; kill `window.confirm` for a styled dialog.
- **Terminal states as CTAs**: all-done → "Start a weekly mission" / "Clear 3 reviews"; empty → route to the
  Climb.
- Drop background polling; invalidate on action using the deltas already returned.
- `role="tablist"` + arrow keys if tabs survive; focus management on scope change.

### 6.3 Integrate with the rest of the app (P1–P2, ~3–5 days)

1. **Mobile IA**: missions is the daily habit loop on the platform that has push, and it currently has no
   tab. Either give it a tab slot, or (cheaper and probably better) put a **"Today" card at the top of the
   home tab** listing the 3 daily missions with inline CTAs, and let `/missions` be the detail view.
2. **Push missions to where they're earned.** After a lesson, an exercise set, or a tool open, show a
   "Mission advanced — 2/3 lessons, +25 XP at 3/3" chip. Backend already returns `missions` deltas and
   `missions_completed_now` from the lesson endpoint; web ignores both. Extend the same response shape to
   the exercise and tool endpoints.
3. **Climb map**: badge the nodes that satisfy an active mission — the journey is where users already are,
   and it currently has no idea missions exist.
4. **Leaderboard/leagues**: "missions completed" column or a "finish 2 missions to hold your league spot"
   nudge; mission XP is what determines placement.
5. **Move wagers off the missions page** to the streak/league surface.
6. **Notifications**: no CIO campaign references missions today. A single "2 missions left, resets in 3h"
   evening push is the obvious retention hook once §6.1 makes the board honest.

### 6.4 Content/pool rework (P2)

- Cut `add_savings` from 5/12 daily to 1–2, or redesign it as a real budgeting exercise instead of a
  free-text number.
- Add goal types with genuine action: `complete_exercise_set`, `use_tool`, `beat_quiz_score`,
  `maintain_streak`, `finish_story_step`.
- Replace "one per goal_type" with a rotation that varies the *verb* day to day, so the board isn't
  identical for 365 days.

---

## 7. Suggested order

| Phase | Work | Why first |
|---|---|---|
| 0 | §6.1 items 1–5 | A quarter of the board is permanently broken and quests pay nothing. No UI work is worth doing on top of that. |
| 0.5 | §6.1 item 6 | XP is client-forgeable today. |
| 1 | §6.2 | Turn the ledger into a board; fixes web/mobile parity in the same pass. |
| 2 | §6.3 items 1–2 | Biggest engagement lever: missions become visible where users already are. |
| 3 | §6.3 items 3–6, §6.4 | Cross-surface polish and content depth. |
