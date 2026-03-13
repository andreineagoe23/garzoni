# AI prompt: generate mission ideas for the Missions pool

Use the prompt below with an AI (e.g. ChatGPT, Claude) to generate a list of **daily** and **weekly** missions. You can then add them as `Mission` rows in Django admin (or import via a script).

---

## Prompt to paste

```
You are helping design missions for a financial literacy app. Users see "Daily Missions" and "Weekly Missions." Each mission has a name, short description, a "why this matters" sentence, a goal type, and a numeric target where applicable.

**Constraints:**
- Mission names: short and actionable (e.g. "Save £10 Today", "Complete 1 Lesson", "Read Finance Fact").
- Description: one sentence explaining what the user must do.
- Purpose statement ("why this matters"): one sentence on how this helps their finances or habits.
- Goal types and goal_reference format (use exactly these):
  1. **complete_lesson** – goal_reference: { "required_lessons": 1 } (or 2, 3 for weekly).
  2. **add_savings** – goal_reference: { "target": 10 } (daily, in £) or { "target": 100 } (weekly, in £).
  3. **read_fact** – goal_reference: {} (read one fact). For weekly, we use a special "5 facts" mission with target in backend.
  4. **complete_path** – goal_reference: {} (complete one learning path).
  5. **clear_review_queue** – goal_reference: { "target_count": 5 } (complete 5 review items).

**Output format:** For each mission, output a JSON object with:
- name (string)
- description (string)
- purpose_statement (string)
- mission_type: "daily" or "weekly"
- goal_type: one of complete_lesson, add_savings, read_fact, complete_path, clear_review_queue
- goal_reference: object as above
- points_reward: integer (e.g. 20 for daily, 50–135 for weekly)

**What to generate:**
- At least **6 daily missions** (mix of complete_lesson, add_savings, read_fact; optionally one clear_review_queue). Vary targets (e.g. 1 lesson, Save £5, Save £10, Save £20; read 1 fact).
- At least **6 weekly missions** (e.g. complete path, save £100, read 5 facts, complete 3 lessons, clear 10 review items). Vary points_reward (e.g. 50–135).

Keep tone encouraging and practical. Output only valid JSON array of mission objects, no extra commentary.
```

---

## Example output (structure)

```json
[
  {
    "name": "Save £5 Today",
    "description": "Add £5 to your savings jar today.",
    "purpose_statement": "Small daily saves build the habit and grow your emergency fund.",
    "mission_type": "daily",
    "goal_type": "add_savings",
    "goal_reference": { "target": 5 },
    "points_reward": 15
  },
  {
    "name": "Complete 2 Lessons",
    "description": "Finish 2 lessons in a single day.",
    "purpose_statement": "Doing two lessons in one day strengthens recall and speeds progress.",
    "mission_type": "daily",
    "goal_type": "complete_lesson",
    "goal_reference": { "required_lessons": 2 },
    "points_reward": 25
  }
]
```

---

## After you have the JSON

1. **Django admin**: Create each mission under **Gamification → Missions** with the same fields. Leave `fact` and `is_template` as default unless you have a specific finance fact or template use.
2. **Existing users**: If you already have users, create `MissionCompletion` for them for the new missions (e.g. via a management command or in the shell), or they will only get new missions on next signup.
3. **New users**: The existing signup signal already assigns all missions to new users; no code change needed.

The app will then show **4 random daily** and **4 random weekly** missions per user per day/week (see `docs/missions-pool-and-randomization.md`).
