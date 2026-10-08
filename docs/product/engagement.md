# Engagement and gamification

> Learners earn **XP** for lessons, sections, quizzes, exercises and missions, and **coins** for
> most of the same things. XP drives the leaderboards, weekly leagues and a level label; coins buy
> streak freezes and rewards-shop items, or go to donation causes. A daily **streak** counts days in a
> row with activity, judged on the learner's own timezone. Every day there are 4 daily and 4 weekly
> **missions**, picked from a pool of 22, with one swap a day. **Leagues** (Bronze → Diamond, weekly
> cohorts of up to 30) are switched on. Friends, friend leaderboards, streak wagers and referrals work
> on both platforms. Duels are mobile-only and partly unreachable, the friend activity feed is never
> shown, and everything behind `GAMIFICATION_RETENTION_V2` (weekly recap, streak-rescue missions) is
> switched off. Owning a streak freeze does not reliably save a streak: the midnight reset runs first
> (see [Known gaps](#known-gaps-and-flags)).

_Last reviewed: 2026-10-08, against `master` at `d431e781`._

## At a glance

| Feature                                                | Web                                 | Mobile                                                                | Plan                                                     | Status                                                                                        |
| ------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| XP and coins                                           | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Level label (Beginner / Intermediate / Advanced I–X+)  | ⚠️ used for copy only, no tier card | ✅ `XPProgressCard`                                                   | All                                                      | Shipped. The mobile card is the only place the tier is shown                                  |
| Daily goal (50 XP)                                     | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Streak                                                 | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Streak freeze: see inventory                           | ✅ on `/missions`                   | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Streak freeze: use or buy                              | ❌                                  | ✅ `StreakFreezeModal`                                                | All                                                      | **Partial.** Mostly fails in practice, see gaps                                               |
| Streak boost                                           | shows inventory                     | shows inventory                                                       | —                                                        | **Effectively dead.** Nothing in the code ever gives a user one                               |
| Streak milestones (3/7/14/30 days)                     | ✅                                  | ✅                                                                    | All                                                      | Shipped. The bonus is granted silently; the Customer.io celebration journey is an empty shell |
| Streak wagers                                          | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Daily and weekly missions                              | ✅ `/missions`                      | ✅ `app/missions.tsx`                                                 | All                                                      | Shipped                                                                                       |
| Mission swap                                           | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Multi-step quests                                      | ✅                                  | ✅                                                                    | All                                                      | Shipped (XP and badge now paid on the last step)                                              |
| Streak-rescue missions                                 | —                                   | —                                                                     | —                                                        | **Flagged off** (`GAMIFICATION_RETENTION_V2=False`)                                           |
| Global leaderboard: week / month / all-time / by skill | ✅ `/leaderboards`                  | ✅ Leaderboard tab                                                    | All                                                      | Shipped                                                                                       |
| Friends leaderboard                                    | ✅                                  | ✅                                                                    | All                                                      | Shipped. All-time points only, no time filter                                                 |
| Leagues                                                | ✅ Leagues tab                      | ✅ Leaderboard tab                                                    | All                                                      | Shipped. `LEAGUES_ENABLED=True` by default                                                    |
| Friend requests and friends list                       | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Friend profile page                                    | ❌                                  | ✅ `friend/[id].tsx`                                                  | All                                                      | Mobile-only                                                                                   |
| Friend activity feed                                   | ❌                                  | ⚠️ `app/feed.tsx` exists                                              | —                                                        | **Dead.** Nothing navigates to it                                                             |
| Duels (multi-day XP race)                              | ❌                                  | ⚠️ `duels/[id]`, `duels/new/[id]`; the list screen has no entry point | All                                                      | **Partial, mobile-only, untested**                                                            |
| Badges                                                 | ✅                                  | ✅                                                                    | All                                                      | Shipped                                                                                       |
| Rewards shop and donations                             | ✅ `/rewards`                       | ✅ `rewards.tsx`                                                      | All                                                      | Shipped. Coins are deducted; nothing fulfils the order in code                                |
| Referrals                                              | ✅                                  | ✅                                                                    | All                                                      | Shipped. The 50% discount reward can only be redeemed through the Django Stripe checkout      |
| Hearts (lives)                                         | ✅                                  | ✅                                                                    | All; Plus/Pro regenerate faster and refill without a cap | Shipped                                                                                       |
| Weekly recap                                           | —                                   | —                                                                     | —                                                        | **Flagged off**, and no client calls the endpoint                                             |

## How it works (user's view)

**XP, coins and level.** Finishing a lesson, a lesson section, a quiz, a course or a path pays XP
and coins. Correct exercise answers and missions pay XP only. XP totals give a level label: Beginner
below 750 XP, Intermediate from 750, Advanced from 2,500, then a new "Advanced II, III …" band every
2,500 XP until "Advanced X+" at 25,000. The level is worked out in the app
(`packages/core/src/utils/userLevel.ts`), not stored on the server.

**Streak.** Doing something that counts (a lesson, a quiz pass, and so on) on a new day adds one to
the streak. Missing a whole day ends it. "Day" means the learner's own calendar day, using the
timezone their phone reports. On mobile, a phone notification is scheduled for 8pm local time on
each of the next 7 days, and is re-armed whenever the app opens (see
[notifications.md](notifications.md)). At 3, 7, 14 and 30 days the learner gets bonus XP and coins.

**Streak freeze.** A freeze is meant to cover a missed day. On mobile, if the streak drops from more
than 3 to 0, the home screen offers a "Use Streak Freeze" sheet. If the learner has no freeze, it
buys one for 10 coins on the spot. Web shows how many freezes you own but has no way to use one.

**Streak wager.** The learner bets some XP that their streak will grow by 3, 7, 14 or 30 days. If it
does, they get back 1.5× the stake in XP plus some coins. If not, the stake is lost. A wager can be
cancelled, with a full refund, only on the day it was opened.

**Missions.** The missions page shows 4 daily and 4 weekly missions, plus any multi-step quests.
Missions move forward on their own when the learner does the matching thing: finishing lessons,
clearing review items, reading a finance fact, adding to the simulated savings pot, finishing a
course. A finished mission pays its XP. Once a day the learner can swap one mission they have not
finished for another from the pool.

**Leaderboards and leagues.** The global leaderboard shows the top 10 by XP earned this week, in the
last 30 days, or all time, or by mastery in one skill. The friends tab shows the top 10 friends by
all-time points. Leagues put the learner in a weekly group of up to 30 people in the same tier
(Bronze, Silver, Gold, Diamond). At the end of the week the top 5 move up a tier, the bottom 5 move
down, and everyone else stays.

**Friends.** Learners send and accept friend requests. On mobile they can open a friend's profile and
start a duel from there.

**Duels (mobile only).** Challenge a friend to earn more XP in 24 hours, 3 days or 7 days. The
winner gets bonus XP.

**Rewards shop and donations.** Coins can be spent on items in the shop, or given to a donation
cause. Both are listed on the Rewards page.

**Referrals.** Every learner has an 8-character referral code and a link
(`/welcome?ref=CODE`). When someone signs up with it, both get XP straight away. When the new learner
has verified their email and finished their first lesson, both get a 50%-off promotion code.

**Hearts.** Learners have up to 5 hearts. Hearts come back over time, faster on Plus and Pro.
Starter users can refill instantly 3 times a day; Plus/Pro without a cap. Getting 2 review answers
right earns a heart, up to 2 a day.

## Rules and numbers

All values below are code defaults. Several can be overridden by environment variable; the
production values of those were not checked.

### XP and coins (`backend/gamification/services/rewards.py:22-55`)

| Event                                                                                      | XP                                                                                                                                                                 | Coins           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Lesson, first completion                                                                   | 10                                                                                                                                                                 | 5               |
| First lesson ever (one-time bonus)                                                         | +25                                                                                                                                                                | —               |
| Lesson section, first completion                                                           | 8                                                                                                                                                                  | 4               |
| Quiz pass                                                                                  | 20 (+5 the first time that quiz is passed)                                                                                                                         | 10              |
| Course complete                                                                            | 50                                                                                                                                                                 | 50              |
| Path complete                                                                              | 100                                                                                                                                                                | 100             |
| Exercise answer (`education/views.py:1197-1206`)                                           | 15 if correct, +5 on first try, −2 per hint, +2 for a correct "low confidence" answer. Capped at 120 per attempt. A negative result (wrong answer) is not deducted | —               |
| Streak milestone 3 / 7 / 14 / 30 days                                                      | 10 / 25 / 50 / 100                                                                                                                                                 | 2 / 5 / 10 / 20 |
| League week: promoted / held / demoted (`gamification/services/leagues.py:68-72`)          | 50 / 20 / 0                                                                                                                                                        | 5 / 2 / 0       |
| Duel win, 24 h / 72 h / 7 days (`gamification/services/duels.py:21-25`)                    | 100 / 250 / 500                                                                                                                                                    | —               |
| Quick "async duel" win (`gamification/views.py:523`)                                       | 15                                                                                                                                                                 | 1               |
| Referral signup, referrer / new user (`authentication/services/referral_rewards.py:19-20`) | 50 / 25                                                                                                                                                            | —               |
| Mission                                                                                    | the mission's `points_reward` (10–180, see below)                                                                                                                  | —               |

- Daily goal: `GAMIFICATION_DAILY_GOAL_TARGET_XP`, default **50** (`settings/settings.py:206`).
- Every grant goes through `grant_reward()`, which writes one `RewardLedgerEntry` per unique
  `event_key`. A repeated key is ignored, so the same lesson cannot pay twice.
- **Two exceptions bypass the ledger:** referral signup XP (`add_points` directly,
  `referrals.py:50-51`) and the wager stake debit (`spend_points`). The weekly and monthly
  leaderboards and leagues read the ledger, so referral XP counts only on the all-time board.

### Streak (`backend/authentication/models.py:196-300`, `backend/education/tasks.py:191-250`)

- `UserProfile.update_streak()` is the one definition. Same day: no change. Next day: +1. Gap of 2
  or more days: freezes are used one day at a time to cover the gap; if they run out, the streak
  restarts at 1.
- "Today" is `UserProfile.local_today()`, the learner's own timezone (`timezone_name`, reported by
  the phone). Web-only users have no `timezone_name`, so the server's Europe/London date is used.
- `reset_inactive_streaks` runs at server midnight. Anyone whose last activity is 2 or more of their
  own days ago gets `streak=0` **and** `last_completed_date=None`. It does not look at freezes.
- If a streak of more than 3 days ended within the last 3 days, the reset sends a "streak ended"
  email and push.
- Freeze price when bought at the moment of use: **10 coins** (`gamification/views.py:865`).
- Mobile local reminders: 8pm device time, 7 days ahead, armed once the streak is at least 1
  (`mobile/src/streak/streakReminder.ts:14-28`).

### Streak wagers (`backend/gamification/services/wagers.py`)

| Target days | Stake (XP) | Win payout (XP) | Win payout (coins) |
| ----------- | ---------- | --------------- | ------------------ |
| 3           | 20         | 30              | 1.00               |
| 7 (default) | 40         | 60              | 2.00               |
| 14          | 80         | 120             | 4.00               |
| 30          | 150        | 225             | 7.50               |

- The stake is never more than 25% of the learner's current XP; if that brings it below 10 XP, the
  wager is refused. One active wager at a time, at most 3 opened per 30 days, and you need a streak
  of at least 1.
- Win = the streak grew by at least the target number of days. Resolved daily at 00:30.
- The stake is XP, never coins, on purpose: coins buy real-value items, and staking them would be
  gambling for an under-18 audience (`wagers.py:1-11`).

### Missions

- Pool: `backend/gamification/fixtures/mission_pool.json`, **22 missions: 12 daily, 10 weekly.** This
  is the seed file; the live pool is whatever is in the database (it can be changed in Django admin
  or with `author_missions`).

  | Type   | Goal                               | Count | XP range |
  | ------ | ---------------------------------- | ----- | -------- |
  | Daily  | `complete_lesson` (1–3 lessons)    | 3     | 25–60    |
  | Daily  | `add_savings` (£3–£20)             | 5     | 12–40    |
  | Daily  | `clear_review_queue` (3–10 items)  | 3     | 15–35    |
  | Daily  | `read_fact`                        | 1     | 10       |
  | Weekly | `complete_lesson` (3–7 lessons)    | 3     | 60–120   |
  | Weekly | `add_savings` (£50–£200)           | 3     | 80–180   |
  | Weekly | `clear_review_queue` (15–25 items) | 2     | 70–100   |
  | Weekly | `read_fact` (5 facts)              | 1     | 55       |
  | Weekly | `complete_path`                    | 1     | 150      |

- Shown: **4 daily, 4 weekly** (`gamification/views.py:83-84`). The pick is seeded on
  user + type + cycle, so it is stable for the day or week, and it takes one mission per goal type
  first (`services/mission_cycles.py:166-201`). With 4 daily goal types and 4 slots, the daily board
  is always one lesson, one savings, one review and one fact mission; only the names change.
- Cycles: daily = calendar date, weekly = ISO week (`2026-W41`). These use the **server** date
  (Europe/London), not the learner's own date like streaks do.
- Swap: one per server day, across daily and weekly together; a finished mission cannot be swapped
  (`gamification/services/missions.py:301-310`).
- Progress: `complete_lesson` +100/N per lesson; `add_savings` adds the amount ÷ target;
  `read_fact` completes a daily at once and adds 20% for the weekly; `complete_path` = best course
  completion % across paths; `clear_review_queue` is recalculated from the live count of due review
  items, now triggered on each review answer (`education/views.py:2226-2240`).
- Manual completion (`POST /missions/complete/`) adds +20% for first try, +15% for mastery, +30%
  if the learner owns a streak boost. The client declares the first two (see gaps).
- Quests (`MultiStepMission`): seeded with 200 and 180 XP plus a named badge, paid on the last step
  (`gamification/models.py:251-279`).

### Leagues (`backend/gamification/services/leagues.py`)

- Tiers: Bronze, Silver, Gold, Diamond. New learners start in Bronze; after that, they start each
  week in the tier their last result left them in.
- A learner joins a league the first time they earn XP in a week. Groups hold up to
  `LEAGUE_COHORT_SIZE` = **30**; when one is full, a new one opens. If a tier has fewer than **5**
  people that week, they are merged into a neighbouring tier.
- Week close, Sunday 23:55 server time: groups of fewer than **10** people all stay put. Otherwise
  the top **5** move up and the bottom **5** move down.

### Leaderboards (`backend/gamification/views.py:415-475`, `services/leaderboards.py`)

- Global: top **10**. `week` = since Monday 00:00 server time, `month` = last **30 days** (not the
  calendar month), both summed from the reward ledger and cached 60 s. `all-time` = lifetime
  `UserProfile.points`. `?skill=` ranks by mastery in one skill and ignores the time filter.
- Friends: top **10** friends by lifetime points (`authentication/views_friends.py:199-235`).

### Duels (`backend/gamification/services/duels.py`)

- Lengths: 24 h, 72 h, 7 days. At most **3** active or pending duels per user, and a **60-minute**
  wait before challenging the same person again. An invitation not answered in 24 h expires.
  Finished duels are scored every 5 minutes.

### Hearts (`backend/authentication/services/hearts.py`, `views_hearts.py`)

- Maximum **5**. One heart back every **30 min** (Starter) or **15 min** (Plus/Pro).
- Instant refills: **3 a day** for Starter (`HEARTS_FREE_REFILL_DAILY_CAP`), no cap for Plus/Pro.
- Practice earns hearts: **2** correct review answers = 1 heart, up to **2** a day.
- Hearts are taken away by the app calling `POST /user/hearts/` with an amount; the server does not
  decide when a heart is lost.

### Referrals (`backend/authentication/services/referrals.py`, `referral_rewards.py`)

- Code: 8 upper-case characters, made at profile creation (`authentication/models.py:308-313`).
- Blocked: referring yourself, the same email on both accounts, and a second referral for the same
  new user.
- Discount: a single-use 50%-off Stripe promotion code for each side, once the new user has a
  verified email and one finished lesson. At most **10** unused codes per referrer at a time.

### Badges

- Criteria types: lessons completed, courses completed, streak days, points earned, missions
  completed, savings balance, plus an optional content-specific `criteria_slug`
  (`gamification/models.py:7-52`). Levels: bronze, silver, gold.
- Checked by a Celery task, at most once every 30 seconds per user, after any XP grant
  (`rewards.py:61-97`). The badge catalogue itself lives in the database.

## Under the hood

| Area                              | Where                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grants, ledger, streak milestones | `backend/gamification/services/rewards.py`                                                                                                                                         |
| Streak rules                      | `backend/authentication/models.py` (`update_streak`, `local_today`), `backend/education/tasks.py` (`reset_inactive_streaks`)                                                       |
| Freeze and boost inventory        | `gamification.StreakItem`, `services/streak_freezes.py`, `StreakItemView` (`gamification/views.py:812-926`)                                                                        |
| Wagers                            | `services/wagers.py`, `StreakWagerView`                                                                                                                                            |
| Missions                          | `gamification/models.py` (`Mission`, `MissionCompletion.update_progress`), `services/mission_cycles.py`, `services/missions.py`; shared card logic `packages/core/src/engagement/` |
| Leagues                           | `services/leagues.py`; mobile view state `mobile/src/components/leaderboard/`                                                                                                      |
| Leaderboards                      | `services/leaderboards.py`, `LeaderboardViewSet`, `FriendsLeaderboardView`                                                                                                         |
| Duels                             | `services/duels.py`, `views_duels.py` (6 endpoints)                                                                                                                                |
| Friends, referrals, hearts        | `backend/authentication/views_friends.py`, `services/referrals.py`, `services/referral_rewards.py`, `services/hearts.py`                                                           |
| Shop and donations                | `finance.Reward` (`type` = `shop` or `donate`), `finance.UserPurchase`, `UserPurchaseViewSet` (`finance/views.py:1920`)                                                            |
| Client API                        | `packages/core/src/services/userService.ts`, `socialService.ts`                                                                                                                    |

**Scheduled jobs** (static list in `backend/settings/celery.py:36-165`; production uses the database
scheduler, see [notifications.md](notifications.md#scheduled-jobs)):

| Job                                              | When (server time, Europe/London)                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `reset_inactive_streaks`                         | 00:00 daily                                                                                              |
| `reset_daily_missions` / `reset_weekly_missions` | 00:00 daily / Monday. With lazy assignment these only archive old rows; new picks are calculated on read |
| `resolve_wagers_task`                            | 00:30 daily                                                                                              |
| `finalize_due_duels`                             | every 5 min                                                                                              |
| `close_leagues_week`                             | Sunday 23:55                                                                                             |
| `spawn_streak_rescue_missions`                   | 18:00 daily, **does nothing** while `GAMIFICATION_RETENTION_V2` is off                                   |
| `decay_course_mastery`                           | 03:20 daily (database row only, from `education/0040`)                                                   |

**Flags** (`backend/settings/settings.py`):

| Flag                        | Default   | What it controls                                                                        |
| --------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `GAMIFICATION_RETENTION_V2` | **False** | Weekly recap API, streak-rescue missions, extra profile fields                          |
| `LEAGUES_ENABLED`           | True      | All league code                                                                         |
| `MISSIONS_LAZY_ASSIGNMENT`  | True      | Picks calculated on read; the old "create a row for every mission" path is the fallback |
| `BADGE_EVAL_SYNC`           | `DEBUG`   | Check badges straight away instead of in a background task                              |
| `LEAGUE_COHORT_SIZE`        | 30        | Group size                                                                              |

Gamification sends three events to Customer.io (`lesson_completed`, `streak_milestone`,
`league_week_closed`), only when both `CIO_JOURNEY_EVENTS_ENABLED` and `CIO_TRACK_ENABLED` are on.
See [notifications.md](notifications.md).

## Known gaps and flags

- **A streak freeze almost never saves a streak.** `reset_inactive_streaks` sets `streak=0` and
  `last_completed_date=None` at midnight without checking freezes (`education/tasks.py:216-224`).
  A freeze only fills a gap when `last_completed_date` is set and is 2 or more days old
  (`authentication/models.py:200-210`). Before midnight the gap is only 1 day; after midnight the date
  is gone. The mobile sheet appears exactly when the streak has dropped to 0, so "Use Streak Freeze"
  then returns "No streak gap to repair". Coins are not lost: the purchase is rolled back. Only
  learners whose local day runs ahead of or behind London get a short window where it works. This
  comes from reading the code and has not been tested on a device. It also undercuts the wager rule
  that "a freeze legitimately saves a wager" (`wagers.py:220-226`).
- **Streak boosts cannot be earned.** Nothing creates a `streak_boost` item, and nothing creates a
  freeze except the 10-coin purchase at the moment of use.
- **Missions trust the client.** `POST /missions/` and `/missions/<id>/update/` take a progress
  amount from the app, and `POST /missions/complete/` takes self-declared `first_try` and
  `mastery_bonus` (`docs/ux/missions-audit-2026-08.md` §3). `add_savings` missions complete when you
  type a number into a simulated pot.
- **Mission days are London days, streak days are the learner's days.** A learner in Bucharest gets
  new daily missions at 02:00 local time, and the one-swap-a-day limit follows London too.
- **The daily mission board never really changes.** One mission per goal type, 4 goal types, 4
  slots.
- **Leaderboards disagree with each other.** All-time uses `UserProfile.points` (includes referral
  XP, reduced by wager stakes). Week and month use the ledger (no referral XP, stakes not deducted).
- **The rewards shop has no fulfilment.** A purchase takes the coins and writes a `UserPurchase`
  row, visible only in Django admin. Nothing ships an item or makes a donation in code. The purchase
  is also not locked, so two fast requests could both pass the balance check
  (`finance/views.py:1940-1948`).
- **Referral discount is web-checkout only.** The 50% code is applied only in the Django Stripe
  checkout (`finance/views.py:2716`). App-store and RevenueCat purchases cannot use it.
- **Duels are mobile-only and partly unreachable.** No web route; `mobile/app/duels/index.tsx` has
  no entry point; `views_duels.py` has no tests. `gamification/` has no app-level test module.
- **Friend activity feed is dead.** `mobile/app/feed.tsx` is complete but nothing links to it.
- **Weekly recap is off twice over.** `GAMIFICATION_RETENTION_V2=False`, and no web or mobile code
  calls `/weekly-recap/`.
- **Streak milestones and league results are not announced.** The backend events exist, but
  Customer.io automations 21 (streak milestone) and 20 (league result) are empty shells with no
  trigger (`.claude/context/feature-status.md`).
- **Shared logic still duplicated:** `heartsPracticeStatus.ts`, `wagerHelpers.ts` and
  `pendingReferral.ts` exist in both apps instead of `packages/core`
  (`.claude/context/parity-matrix.md`).
- **The level tier card is mobile-only.** Web uses the level only to adjust copy on the missions
  page.
