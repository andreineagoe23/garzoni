# Exercise answer integrity

**Status: CURRENT.** Written 2026-08-25. Covers the two ways a Garzoni question could be answered
without reading it, the commands that fix each, and the order they must run in.

Four surfaces carry multiple-choice questions, and they are **not** all handled by the same command:

| Surface                        | Model                                | Rebalance                            | Rewrite                                           |
| ------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------------------- |
| A. In-lesson knowledge checks  | `LessonSection`                      | `rebalance_mc_answer_positions`      | `rewrite_exercise_sections`                       |
| B. Lesson checkpoint reviews   | `Quiz` (`source_lesson_section` set) | follows A automatically              | follows A automatically                           |
| C. Course capstone quizzes     | `Quiz` (no source section)           | `rebalance_catalog_answer_positions` | `rewrite_standalone_exercises --target quizzes`   |
| D. Standalone practice catalog | `Exercise`                           | `rebalance_catalog_answer_positions` | `rewrite_standalone_exercises --target exercises` |

B is a materialized copy of A — never rewrite it directly, or it forks from the section it mirrors.

Read this before running any `rewrite_*` content command or changing
`education/exercise_quality.py`.

---

## The two tells

Measured across all 334 published multiple-choice `LessonSection` rows on 2026-08-25:

| Tell                                              | Before                                                | After (applied 2026-08-25) |
| ------------------------------------------------- | ----------------------------------------------------- | -------------------------- |
| Correct answer sits in slot 2                     | **252 / 334 (75%)**, and slot 4 was **never** correct | 25% per slot               |
| Correct answer is the longest option              | **317 / 334 (95%)**                                   | 216 / 334 (65%)            |
| Correct option's length edge over its distractors | **+38.8 chars**                                       | **+3.1 chars**             |
| Option length ratio (median / worst)              | 2.16 / 10.00                                          | **1.09 / 1.39**            |

The correct option used to average **+39 characters** over its distractors — a learner could score by
picking the longest option without reading the stem.

"Is longest" is still 65% rather than the 25% chance rate, but the magnitude is what matters: where
the correct option is longest it now beats the runner-up by a **median of 2 characters**, and 47 of
those are exact ties. That is below what anyone can eyeball. Driving it to chance means tightening
`MAX_CORRECT_OVERSHOOT` from 1.15 to ~1.02, which costs materially more retries for a tell that is
already imperceptible — judged not worth it.

### Where they came from

Both were produced by `rewrite_exercise_sections`:

- Its two few-shot examples both placed the answer at index 1, and in both the correct option was
  the longest, most complete-sounding sentence. The model copied the pattern.
- The prompt said _"the correct answer must remain at the SAME INDEX as the original"_, and
  `_validate()` never checked anything beyond "4 strings", so the bias was preserved on every pass
  and never measured.

A third, quieter bug: because the model was never asked which option it made correct, a rewrite
could reorder the options and leave `correctAnswer` pointing at a **distractor**. Nothing would have
caught it. The live run on 2026-08-25 hit this 9 times in the first 137 sections.

---

## What now prevents regression

| Guard                                                                                          | Where                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Model must return `correct_index`, validated against the slot we asked for                     | `rewrite_exercise_sections._validate`                        |
| Option length spread (`max/min ≤ 1.6`), min 25 chars, correct option ≤ 1.15× its nearest rival | `education/exercise_quality.py:length_problem`               |
| Rejection reason is fed back into the retry prompt                                             | `rewrite_exercise_sections._build_user_prompt(retry_note=…)` |
| Explicit character budget per option, anchored to the question's existing options              | `exercise_quality.target_length_band`                        |
| Few-shot examples answer at slots 3 / 0 / 2, all length-balanced                               | `rewrite_exercise_sections.FEW_SHOT_EXAMPLES`                |
| Per-section length gate + corpus slot report                                                   | `validate_lesson_quality_gates`                              |

Giving the model an explicit character band rather than the ratio rule took the pass rate from
**3/5 to 5/5** in testing. Without the band it has to reason about the ratio and misses ~40% of the
time.

Check the corpus at any point:

```bash
docker compose exec backend python manage.py validate_lesson_quality_gates
# Answer slot (334 multiple-choice checks): [0] 84 (25%)  [1] 84 (25%)  [2] 83 (25%)  [3] 83 (25%)
# Correct option is the longest: 216 (64.7%)     <- reading as of 2026-08-25, post-apply
```

---

## Running the fix

### 1. Answer position — deterministic, no API cost

```bash
docker compose exec backend python manage.py rebalance_mc_answer_positions --dry-run
docker compose exec backend python manage.py rebalance_mc_answer_positions
```

Seeded by section id, so a re-run is a no-op rather than a reshuffle. It moves every index-aligned
copy of the options together: `LessonSectionTranslation.exercise_data` for every language, plus the
`Quiz` / `QuizTranslation` rows the lesson checkpoint modal reads.

**Applied to the local DB 2026-08-25** — 243 sections moved. Not yet on Railway.
Re-running is a verified no-op ("would move 0 sections").

### 2. Option wording — costs API calls

```bash
# Dry run writes a reviewable JSON, no DB writes.
docker compose exec -e OPENAI_REWRITE_DELAY=10 backend \
  python manage.py rewrite_exercise_sections --dry-run --batch-size 400 \
  --output-file /app/education/content/rewrite_output/batch_<name>.json

# Review the JSON, then:
docker compose exec backend python manage.py rewrite_exercise_sections \
  --apply-from-file education/content/rewrite_output/batch_<name>.json
```

A pre-apply snapshot of every section's `exercise_data` is worth taking first; the 2026-08-25 one is
`content/rewrite_output/pre_apply_snapshot_20260825.json`. The batch file also carries every
`original_*` field, so either is a rollback path.

`OPENAI_REWRITE_DELAY=10` keeps a tier-1 key (30k tokens/min) under its cap. Without it you get
429s that burn retry attempts. Roughly 90 minutes for the full 334.

Sections that fail validation four times are written to the JSON with an `error` field and no
`rewritten_*` values; `--apply-from-file` skips them and they keep their current wording.

### 3. Re-translate — **required after step 2**

`_apply_record` nulls `LessonSectionTranslation.exercise_data` for every section it rewrites, because
the English source changed and the stored Romanian is now stale. That is correct, and it means:

> **Until `translate_lessons_to_ro` runs, Romanian users see English options on every rewritten
> knowledge check.**

```bash
docker compose exec backend python manage.py translate_lessons_to_ro
```

### 4. Push

```bash
docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \
  python manage.py push_rewrites_to_railway --dry-run
```

`push_rewrites_to_railway` selects rows by audit action. It covers both `ai_rewrite` and
`answer_position_rebalance` (see `CONTENT_ACTIONS`), and pulls in checkpoint quizzes via the sections
that changed — those carry no audit row of their own. Before 2026-08-25 it filtered on `ai_rewrite`
alone, so a rebalance would never have reached production.

---

## Outstanding

Blocked 2026-08-25 on **OpenAI credits** (`credit_balance_exhausted`). Top up at
<https://platform.openai.com/settings/organization/billing/>, then run "Resume" below.

| Surface                          | Answer slot | Wording                      |
| -------------------------------- | ----------- | ---------------------------- |
| A. Lesson knowledge checks (334) | ✅ 25% each | ✅ applied, 0% fail the gate |
| B. Checkpoint reviews (43)       | ✅ even     | ✅ follows A                 |
| C. Capstone quizzes (20)         | ✅ 25% each | ⏳ 60% fail the gate         |
| D. Practice catalog (86)         | ✅ 25% each | ⏳ 55% fail the gate         |

Everything above is in the **local dev DB only**. Production has none of it — the push is deliberately
held until C and D are done, so it goes out in one pass.

Also owed:

| Item                                              | State                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Romanian exercise translations                    | All 334 RO rows blank; Romanian falls back to English. Deferred — English first.                                                                                          |
| 2 orphan checkpoint quizzes (sections 1699, 2614) | No longer served (the endpoint filters on `exercise_type="multiple-choice"`). Rows remain; `--prune-orphan-checkpoints` deletes them and cascades their `QuizCompletion`. |
| Rotate the Railway Postgres password              | Credentials were pasted into a chat transcript on 2026-08-25.                                                                                                             |

### Resume after top-up

```bash
# 1. C and D wording (~106 records; the two rebalances are already applied)
docker compose exec -e OPENAI_REWRITE_DELAY=10 backend python manage.py \
  rewrite_standalone_exercises --dry-run --target all --batch-size 200 \
  --output-file /app/education/content/rewrite_output/catalog_<name>.json

# --target all also sweeps drag-and-drop / numeric / budget-allocation, whose
# validators have no answer-shape gates. Pass --only-ids with the multiple-choice
# ids if you want to keep the run to the surfaces this doc is about.

docker compose exec backend python manage.py rewrite_standalone_exercises \
  --apply-from-file education/content/rewrite_output/catalog_<name>.json

# 2. Confirm every surface is clean
docker compose exec backend python manage.py validate_lesson_quality_gates
docker compose exec backend python manage.py rebalance_mc_answer_positions --dry-run      # expect "would move 0"
docker compose exec backend python manage.py rebalance_catalog_answer_positions --dry-run # expect "would move 0"

# 3. One push
docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \
  python manage.py push_rewrites_to_railway --dry-run
docker compose exec -e RAILWAY_DB_URL="<DATABASE_PUBLIC_URL>" backend \
  python manage.py push_rewrites_to_railway
```

### Traps found on 2026-08-25 — do not reintroduce

- **`Exercise` has two sources of truth for the answer index.** The model field
  `Exercise.correct_answer` is what the submit endpoint grades against (`views.py:2128`); some rows
  also carried a `correctAnswer` key inside `exercise_data`, and 11 disagreed with the field. The
  field wins; the shadow key is now stripped. Never read the JSON copy for an `Exercise`.
- **`MultipleChoiceChoice` rows are written back into `exercise_data` by the admin.**
  `ExerciseAdmin.save_related` rebuilds `exercise_data["options"]` and `correct_answer` from those
  rows on every save. 57 of 76 held placeholder text ("Memorize definitions without context", …), so
  saving such an exercise in Django admin replaced real content with boilerplate. The rows are now a
  faithful mirror, which makes that write a no-op — keep them in sync
  (`rebalance_catalog_answer_positions.sync_choice_rows`).
- **An exhausted credit balance returns 429.** All three rewriters used to treat it as a rate limit
  and sleep 60/120/180s per record. They now abort the run with the billing URL.

## Related

- `education/exercise_quality.py` — the shared rules, used by both the rewriter and the gates.
- `education/services/checkpoint_quizzes.py` — `resync_quiz_from_section` keeps a checkpoint in step
  with its section. Before 2026-08-25 a `Quiz` was only ever populated on creation, so every past
  rewrite left the checkpoint modal showing pre-rewrite wording and option order.
- `content/lesson_authoring_standards.md` — the rubric the rewriter is given.
