# Missions pool and “show 4” randomization

## Goal

- Have a **pool** of daily and weekly missions (more than 4 of each).
- **Show 4 missions** in each section (Daily Missions and Weekly Missions).
- **Randomize** which 4 are shown, in a way that is **stable per period**: same 4 for a user for the whole day (daily) or whole week (weekly).

## Approach

1. **Pool in DB**
   Add more `Mission` rows (e.g. 6–10 daily, 6–10 weekly) via Django admin or a data migration. New users get a `MissionCompletion` for every mission in the pool (existing signup signal already does this).

2. **API returns 4 per type**
   In `MissionView.get()`:
   - Load all daily (respectively weekly) `MissionCompletion`s for the user.
   - **Deterministic shuffle**: seed = `hash(user_id + period)`:
     - Daily: period = current **date** (e.g. `YYYY-MM-DD`).
     - Weekly: period = **week start** (e.g. Monday of current week, same format).
   - Shuffle the list with `random.Random(seed)` and take the **first 4**.
   - Return only those 4 in `daily_missions` and `weekly_missions`.

3. **Frontend**
   No change to “how many” to show: it already renders whatever the API returns. Once the API returns 4 daily and 4 weekly, the UI will show 4 in each section.

4. **Swap**
   Swap stays as-is: user swaps one of their current missions for another from the pool (e.g. a mastery-aware or random non-completed mission). The swapped-in mission may be one that wasn’t in the current 4; after next refresh the list is again “4 random for this period,” so the new mission might or might not appear.

## Constants

- **Display count**: 4 daily, 4 weekly (backend: `MISSIONS_DAILY_DISPLAY = 4`, `MISSIONS_WEEKLY_DISPLAY = 4`).
- **Pool size**: whatever you add in admin (recommended at least 6–8 per type so the same 4 don’t repeat too often).

## Adding new missions

Use the **AI mission prompt** (see below) to generate candidate missions, then create them in Django admin (or via a management command / migration). Each mission needs:

- `name`, `description`, `purpose_statement` (optional; if set, frontend can show it as “Why this matters”).
- `mission_type`: `"daily"` or `"weekly"`.
- `goal_type`: one of `complete_lesson`, `add_savings`, `read_fact`, `complete_path`, `clear_review_queue`.
- `goal_reference`: dict matching the goal type (e.g. `required_lessons`, `target`, `target_count`).
- `points_reward`: integer XP.

After saving, new users get them automatically; existing users need to be backfilled.

### Loading from fixture and backfilling (Docker)

- **Load mission pool** from `gamification/fixtures/mission_pool.json`:
  ```bash
  make load-mission-pool
  ```
  Or: `python manage.py load_mission_pool [path/to/file.json]`

- **Backfill** so every existing user has a `MissionCompletion` for every mission (they will then see the full pool, with 4 random daily/weekly shown):
  ```bash
  make backfill-mission-completions
  ```
  Or: `python manage.py backfill_mission_completions`

The API deduplicates by mission when a user has duplicate `MissionCompletion` rows (keeps the entry with highest progress).
