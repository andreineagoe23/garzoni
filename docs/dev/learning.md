# Learning

> Garzoni's learning content is organised as **paths → courses → lessons → sections**. There are 7 paths,
> each with 5 courses of 5 lessons, and every lesson follows the same 9-step layout: text,
> two knowledge checks, and a closing video. Learners move through a course in one continuous "flow".
> Each finished lesson can trigger a short checkpoint quiz, and each course can end with a quiz.
> Wrong answers in a lesson cost **hearts** (lives). Next to the lessons is a standalone **practice**
> area. It has its own exercise catalogue, a spaced-repetition **review queue** and a per-course
> **mastery** score. The onboarding questionnaire feeds a **Personalized Path**: Plus/Pro users see
> all of it, Starter users get the first tile and the rest locked. On Starter, only the Basic Finance
> path is open; Plus adds three paths and Pro adds three more. All lesson content is translated into
> Romanian. Quizzes and about half of the practice exercises are not.

_Last reviewed: 2026-10-08 against `master` at `d431e781`. Counts come from the local development
database (read-only queries, docker stack up), not production. See [Content in numbers](#content-in-numbers)._

## At a glance

| Feature                                        | Web                                  | Mobile                                                     | Plan                                                        | Status                                                                         |
| ---------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Paths, courses, lessons                        | ✅ `/all-topics`, `/courses/:pathId` | ✅ Learn tab, `path/[id]`, `course/[id]`                   | Starter: Basic Finance only. Plus: +3 paths. Pro: all 7     | Shipped                                                                        |
| Lesson flow (text, video, in-lesson exercises) | ✅ `/lessons/:courseId/flow`         | ✅ `flow/[id]`, `lesson/[id]`                              | Same as the path                                            | Shipped. **Web cannot render numeric knowledge checks** (see gaps)             |
| Hearts (lives)                                 | ✅ lesson flow                       | ✅ lesson flow **and course quiz**                         | Everyone. Plus/Pro regenerate faster and have no refill cap | Shipped. Behaves differently per platform                                      |
| Lesson checkpoint quiz                         | ✅ modal after a lesson              | ✅ modal after a lesson                                    | Same as the path                                            | Shipped                                                                        |
| Course quiz ("capstone")                       | ✅ `/quiz/:courseId`                 | ✅ `quiz/[courseId]`                                       | Same as the path                                            | Shipped. 15 of 35 courses have no quiz questions locally                       |
| Standalone practice (exercise catalogue)       | ✅ `/exercises`, `/exercise/:id`     | ⚠️ `(tabs)/exercises`, hidden tab, reached only from links | Everyone. **Not gated by plan**                             | Shipped                                                                        |
| Review queue (spaced repetition)               | ✅ inside `/exercises`               | ✅ inside the exercises screen                             | Everyone                                                    | Shipped                                                                        |
| Mastery and weak skills                        | ✅ dashboard                         | ✅ home and Learn                                          | Everyone                                                    | Shipped                                                                        |
| Onboarding questionnaire                       | ✅ `/onboarding` → `/plan-ready`     | ✅ `onboarding` (plan-ready is an in-screen step)          | Everyone                                                    | Shipped                                                                        |
| Personalized Path                              | ✅ `/personalized-path`              | ✅ Learn tab, "personalized" view                          | Plus/Pro full. Starter: first tile only                     | Shipped                                                                        |
| Weekly Coach Brief                             | ✅ on the Personalized Path page     | ✅ same                                                    | Plus/Pro                                                    | Shipped. Cached for 24 h, so in practice it is daily                           |
| AI help on repeated wrong answers              | ✅                                   | ✅                                                         | Explain: Starter 3/day, Plus/Pro unlimited                  | Shipped. See [ai.md](ai.md)                                                    |
| Romanian content                               | ✅                                   | ✅                                                         | Everyone                                                    | Lessons fully translated. Quizzes not translated. Practice exercises 86 of 178 |
| Public lessons (`/learn`)                      | ✅ web only                          | ❌ (mobile has a separate hard-coded `demo-lesson`)        | No account needed                                           | Shipped. See [website.md](../seo/website.md)                                   |

## How it works (user's view)

### Paths, courses and lessons

A **path** is a topic area, for example "Basic Finance" or "Crypto". It holds **courses**, a course
holds **lessons**, and a lesson is a sequence of **sections**. The learner sees every path. Paths
above their plan show as locked, and opening one returns "Upgrade required to access this learning
path." with the plan it needs.

| #   | Path                  | Plan needed    | Courses | Lessons |
| --- | --------------------- | -------------- | ------- | ------- |
| 1   | Basic Finance         | Starter (free) | 5       | 25      |
| 2   | Financial Mindset     | Plus           | 5       | 25      |
| 3   | Everyday Money Skills | Plus           | 5       | 25      |
| 4   | Personal Finance      | Plus           | 5       | 25      |
| 5   | Real Estate           | Pro            | 5       | 25      |
| 6   | Crypto                | Pro            | 5       | 25      |
| 7   | Forex                 | Pro            | 5       | 25      |

Each **section** has one of three content types:

- **Text**: rich text written in the admin's CKEditor.
- **Video**: an embedded video.
- **Exercise**: an interactive question. The schema allows drag-and-drop, multiple choice,
  numeric, budget allocation, fill-in-table and scenario simulation.

Every one of the 175 lessons uses the same 9-section layout: Overview → Core Concept → **Knowledge
Check 1** → Applied Insight → Practical Walkthrough → **Knowledge Check 2** → Key Takeaways → Next
Steps → Watch & Learn (video). That gives 1,050 text sections, 350 exercise sections and 175 video
sections, all of which have a video URL. Of the 350 in-lesson knowledge checks, 334 are multiple
choice, 13 numeric and 3 drag-and-drop. No lesson uses budget allocation, fill-in-table or scenario
simulation.

### The lesson flow

The learner opens a course, and the app shows that course's lessons one section at a time in a
single scrolling "flow". The current position is saved on the server (`flow_state`), so the
learner can continue on another device.

- **Text and video sections:** pressing Continue marks the section complete.
- **Knowledge checks:** the answer is checked in the app against the section's own data. A correct
  answer completes the section. On web, the learner can also skip past a knowledge check without
  answering it.
- **Wrong answers:** each wrong answer costs **one heart**. On the **second wrong answer in a row**
  to the same question, an **AI help** sheet opens (an explanation, or a hint if that fails). The
  heart for that attempt is taken only after the learner closes the sheet. At **0 hearts** the flow
  is blocked until hearts come back (see [Hearts](#hearts-lives)).
- **End of a lesson:** the app fetches that lesson's **checkpoint**. If any checkpoint questions
  are still unanswered, a modal asks them before the flow moves on.
- **End of a course:** web sends the learner to `/quiz/:courseId`. Mobile shows a button to the quiz.

**Rewards for lesson progress.** These come from `gamification/services/rewards.py` and are paid
only the first time:

| Event                             | XP  | Coins |
| --------------------------------- | --- | ----- |
| Section completed                 | 8   | 4     |
| Lesson completed                  | 10  | 5     |
| First lesson ever (one-off bonus) | +25 | —     |
| Course completed                  | 50  | 50    |
| Path completed                    | 100 | 100   |

Each completed section also raises the learner's mastery for that course (see
[Mastery](#mastery-and-weak-skills)).

### Hearts (lives)

- Every learner has up to **5 hearts**. One heart comes back every **30 minutes** on Starter and
  every **15 minutes** on Plus/Pro.
- **Instant refill** to full: Starter users get **3 a day**. Plus/Pro have no cap. A refill costs
  nothing.
- **Practice to earn hearts:** while at 0 hearts, every **2 correct review-queue answers** earn
  1 heart back, up to **2 a day**.
- Where hearts are spent differs by platform:
  - **Web:** only wrong answers in the lesson flow cost hearts. The course quiz and standalone
    practice do not.
  - **Mobile:** wrong answers in the lesson flow **and** in the course quiz cost hearts.

### Quizzes

There are three kinds of quiz question. All three are stored in the `Quiz` table, where each row is
**one** multiple-choice question.

1. **Lesson checkpoint.** These are copies of the lesson's own multiple-choice knowledge checks:
   the first 3 multiple-choice sections. They are created the first time someone asks for the
   lesson's checkpoint, so no editor has to build them. Questions already answered are skipped.
   In practice the checkpoint repeats the questions the learner has just answered inside the lesson.
2. **Course quiz (capstone).** These are hand-made questions attached to a course and not to any
   lesson. The quiz page goes through the course's unanswered questions one at a time. Locally,
   20 courses have exactly 1 capstone question and **15 courses have none**: all 5 in Everyday
   Money Skills, plus 2 each in Basic Finance, Crypto, Forex and Real Estate, and 1 each in
   Personal Finance and Financial Mindset. A course with no questions shows a "no quiz data" message.
3. **Knowledge checks** are the exercise sections inside a lesson (described above). They are
   not `Quiz` rows.

The **first correct answer** to any quiz question pays **25 XP and 10 coins** and adds +12
mastery to the course. A wrong answer takes −8 mastery and makes the course due for review now.
The learner can try again. Answering a question correctly a second time pays nothing.

### Exercises and practice

Standalone practice uses a separate **exercise catalogue** (the `Exercise` table). It is not the
same data as the in-lesson knowledge checks.

- **Types in the schema:** multiple choice, drag-and-drop, numeric, budget allocation,
  fill-in-table, scenario simulation, and **true/false**. That is seven, though older docs say six.
- **What learners can actually see:** 178 published exercises. By type: multiple choice 96,
  drag-and-drop 60, numeric 16, budget allocation 6. **There are no fill-in-table, scenario
  simulation or true/false exercises in the catalogue**, even though both apps can render them.
  Categories: Basic Finance 55, Financial Planning 34, Cryptocurrency 18, Budgeting 17, Real Estate
  17, Investing 16, Forex 13, Personal Finance 8. Difficulty: 158 beginner, 16 intermediate, 4
  advanced.
- **Visibility rules:** learners see only exercises that are published, have question text (in
  English or a translation), and are not in the internal "General" category.
- **Filters:** the practice page filters by type, category and difficulty. **Plan is not a
  filter**, so a Starter user can practise Crypto or Forex exercises even though those paths are
  locked for them.
- **Grading:** answers are graded on the server. **XP per submission:** 15 for a correct answer,
  +5 if it is the first try, −2 for each hint used, +2 for a correct answer marked "low
  confidence". The maximum is 120 per attempt. Wrong answers pay nothing, and they do not take XP
  away either. An exercise answered correctly before pays 0 XP. Completed exercises can be reopened
  ("Try Again").
- **Hints:** these are the static hints stored with each exercise. The Starter plan says "2 hints
  a day", but nothing on the server counts hint use, so the limit never kicks in. The web button
  also shows a 5-coin cost, but no coins are charged.
- **Web extras:** a timed mode (5 minutes, plus 30 seconds per exercise), and an "explain my
  mistakes" hand-off to the AI tutor at the end of a session.
- **Mobile:** the exercises screen is a hidden tab (`href: null`). Learners reach it only from
  links on the home screen, from missions, and from the lesson flow's "practice to earn hearts"
  button.

### Review queue (spaced repetition)

Mastery is tracked **per course**. Each course has a `due_at` date, and the review queue lists every
course that is due now. For each due course it picks **one** catalogue exercise whose category
matches the course or path title. A due course with no matching exercise is left out of the queue
without any message. Practising from the queue updates mastery and pushes the next review date out
(see below). Both apps show the due count and a "start review" action.

### Mastery and weak skills

Each course has a mastery score from 0 to 100, which the app shows as a level:

| Score | Level       |
| ----- | ----------- |
| 0     | Not started |
| 1–29  | Attempted   |
| 30–69 | Familiar    |
| 70–94 | Proficient  |
| 95+   | Mastered    |

What moves the score:

| Event                               | Effect                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First section completed in a course | set to 20                                                                                                                                                                                                     |
| Each further new section            | +6, up to 60. Going above 60 needs exercises or quizzes                                                                                                                                                       |
| Practice exercise correct           | +10 on a clean first try with no hints, +5 otherwise. **Capped at 90**                                                                                                                                        |
| Practice exercise wrong             | −10, and the course is due for review now                                                                                                                                                                     |
| Quiz question correct (first time)  | +12, capped at 100                                                                                                                                                                                            |
| Quiz question wrong                 | −8, and the course is due for review now                                                                                                                                                                      |
| Inactivity                          | A nightly job (`decay-course-mastery-daily`, 03:20 in the local Beat table) removes 1.5 points per day after 7 idle days. It never goes below a floor based on completed content, and it marks the course due |

The next review comes **1, 1, 2, 4 or 7 days** later, depending on which 20-point band the score is
in. Because practice exercises stop at 90, a learner can reach "Mastered" (95+) **only through
course-quiz questions**.

The **weak skills** list on the dashboard ranks courses by a "weakness score". The score is higher
when proficiency is low, when the review is overdue, when the score dropped over the last 7 days,
and when the learner has rarely practised the course. Each entry links to a suggested next step,
usually a review exercise or the next lesson.

### Onboarding questionnaire

The questionnaire is short and versioned: **6 questions in 2 sections**. The questions come from the
server, so web and mobile show the same set.

- **Goals:**
  - top money goal (budget, debt, savings or invest). Mobile lets the learner pick several, and the
    first pick counts as the main one.
  - biggest challenge
  - when they want to see progress
- **Quick snapshot:**
  - how they get paid
  - how they manage money today
  - how they prefer to learn

Finishing it pays **100 XP and 10 coins**, once. Next comes the "Your plan is ready" summary
(`/plan-ready` on web, a step inside onboarding on mobile), and then the paywall.

### Personalized Path

This is a ranked list of up to 10 courses with a reason for each.

- **Needs a finished questionnaire.** Without one, the API redirects to `/onboarding`.
- **When it refreshes.** The list is rebuilt only when someone opens the page and one of these is
  true:
  - it is more than a day old
  - a recommended course has been completed
  - none of the recommended courses is accessible any more
  - the learner pressed refresh

  No scheduled job does this. The rebuild is also skipped when the questionnaire answers and the
  mastery picture have not changed (checked with a hash), which saves an AI call.

- **How it is built.**
  1. An AI call ranks the **paths the learner's plan allows** using the questionnaire answers and
     mastery. If that fails, keyword weights based on the goal and challenge answers rank them
     instead.
  2. Garzoni takes the first 2 courses from each of the top 3 paths.
  3. It adds other accessible courses in catalogue order until there are 10.
  4. The AI's reasons are stored per course in `PathPlan`.
- **Display order is not the AI order.** The page sorts the chosen courses by path order and
  course order, so the ranking decides only _which_ courses appear. The AI writes reasons per
  path, so courses from the same path show the same reason.
- **Starter users:**
  - The list is still generated, AI call included, but only from the paths Starter can open,
    which is just Basic Finance.
  - The response is cut to the first 5 courses. Course 1 is playable and courses 2–5 are shown
    **locked**, and tapping them leads to the paywall.
  - Those locked tiles are free Basic Finance courses the learner can open from All Topics anyway.
- **Plus/Pro users** see the full list, the reasons, and the Weekly Coach Brief card. Despite the
  name, the brief is cached for 24 hours.

## Plans and limits

|                                | Starter (free)                                  | Plus                                                         | Pro                          |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| Paths                          | Basic Finance (1 path, 5 courses, 25 lessons)   | + Financial Mindset, Everyday Money Skills, Personal Finance | + Real Estate, Crypto, Forex |
| Hearts                         | 5 max, +1 every 30 min, 3 instant refills a day | 5 max, +1 every 15 min, unlimited refills                    | same as Plus                 |
| AI "explain wrong answer"      | 3 a day                                         | unlimited                                                    | unlimited                    |
| Hints                          | "2 a day" on paper, **not enforced**            | unlimited                                                    | unlimited                    |
| Personalized Path              | first tile only                                 | full                                                         | full                         |
| Coach Brief                    | —                                               | ✔                                                            | ✔                            |
| Standalone practice and review | everything (not plan-gated)                     | everything                                                   | everything                   |

**Daily learning limit: there isn't one in the code.** `docs/prod/subscription-matrix.md` and
`docs/README.md` both say Starter has "3 core learning activities a day". No such feature
exists in `authentication/entitlements.py`, and no `daily_limits` or `feature.limit.daily` key
appears anywhere in the backend or the apps. On Starter, what actually limits learning is the
locked paths and the hearts. The only "3 a day" rule in learning is the AI explain quota. (The
`next-steps` tool has its own separate cap of 3 a day.)

Path access is checked on the server for course lists, quiz lists, checkpoints and quiz answers,
using `Path.access_tier`. If that field is blank, a fallback based on the path title is used. Staff
see everything.

The `UX_PAYWALL_PLACEMENT` setting decides whether the paywall appears right after onboarding (the
default) or after the first lesson (`post_first_lesson`).

## Languages

The apps' interface text is in English and Romanian, with the same keys in both. Spanish is listed
as "coming soon" but is switched off. The content language comes from the `X-App-Language` header,
falling back to `Accept-Language`. Only `en` and `ro` are recognised.

| Content                                                   | Romanian coverage (local DB)                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Paths                                                     | 7 / 7                                                                           |
| Courses                                                   | 35 / 35                                                                         |
| Lessons (title, description, body)                        | 175 / 175                                                                       |
| Lesson sections, including the in-lesson knowledge checks | 1,575 / 1,575                                                                   |
| Practice exercises (catalogue)                            | **86 / 178**. The rest are shown in English                                     |
| Quiz questions (checkpoint and capstone)                  | **0**. There are no `QuizTranslation` rows, so all quizzes are in English       |
| Public lessons on `/ro/learn`                             | Served only when the lesson is fully translated. Otherwise the page returns 404 |

What this looks like for a Romanian learner:

- **Checkpoints.** A checkpoint repeats a knowledge check the learner has just seen in Romanian,
  but the checkpoint itself is in English, because it is a `Quiz` copy and has no translation.
- **Untrustworthy translations are hidden.** Where a translation is blank, or its answer options
  do not line up with the English ones, the English version is shown.
- **New content is translated automatically.** Saving a path, course, lesson or section in the
  admin starts a background Romanian translation job. Quizzes and exercises do **not** get one.
  They are translated by management commands (`translate_standalone_exercises_to_ro`, etc.).

## Public lessons on the website

Without an account, anyone can read one sample lesson per course at `/learn/<slug>` (and
`/ro/learn/<slug>`). Locally that is 35 lessons, including the first lessons of Plus and Pro
courses. A lesson is public when an editor ticks `Lesson.is_public`, or when it is the first
lesson (lowest id) of an active course that has text content. The second rule is worked out on
each request, which is why every local lesson still has `is_public = false`. The pages are
prerendered for search engines and are web-only. On mobile, the closest equivalent is
`demo-lesson`, a hard-coded 50/30/20 sample for people who are not signed in. Full details are in
[website.md](../seo/website.md).

## Under the hood

### Content in numbers

These counts come from read-only `manage.py shell` queries against the local docker database on
2026-10-08. `.claude/context/debt-register.md` #37 records local and production lesson sections as
matching (1,575/1,575, keyed on slug and order). Quiz and exercise rows were not compared, and row
ids differ between environments.

- 7 paths, 35 courses (all active), 175 lessons, 1,575 sections (all published)
- 65 `Quiz` rows: 45 checkpoint copies (for the 24 lessons opened locally so far) and 20 capstones
- 181 `Exercise` rows, 178 published and visible to learners
- 5 lessons still carry the old lesson-level `exercise_type`. Web shows a "legacy exercise format"
  notice for these

### Models: `backend/education/models.py`

| Model                                                                             | Role                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Path`                                                                            | `access_tier` (starter / plus / pro), `sort_order`                                                                                                   |
| `Course`                                                                          | belongs to a path, `order`, `is_active`                                                                                                              |
| `Lesson`                                                                          | `slug`, `is_public`, `sample_question` (teaser for the public page), plus legacy `exercise_type`/`exercise_data`                                     |
| `LessonSection`                                                                   | `content_type` (text / video / exercise), `exercise_type`, `exercise_data` JSON, `is_published`. Unique per (lesson, order)                          |
| `UserProgress`                                                                    | one row per (user, course): completed lessons and sections, `flow_current_index`, per-course day streak                                              |
| `LessonCompletion`, `SectionCompletion`                                           | completion through-tables                                                                                                                            |
| `DailyActivityLog`                                                                | one row per section, lesson, exercise or quiz activity per day                                                                                       |
| `Quiz`, `QuizCompletion`                                                          | one question per row. `lesson` + `source_lesson_section` set means a checkpoint. Neither set means a capstone                                        |
| `Exercise`, `MultipleChoiceChoice`, `UserExerciseProgress`, `ExerciseCompletion`  | practice catalogue and per-user attempts                                                                                                             |
| `Mastery`, `MasterySnapshot`                                                      | per (user, course) proficiency, `due_at`, and daily snapshots for 7-day deltas. Rows with `legacy=True` (old skill-string rows) must be filtered out |
| `PathPlan`                                                                        | Personalized Path rank and reason per (user, course)                                                                                                 |
| `*Translation` (Path, Course, Lesson, LessonSection, Quiz, Exercise)              | one row per language, with `source_hash` for spotting stale translations                                                                             |
| `ContentEmbedding`                                                                | lesson and course embeddings for the tutor's search (see [ai.md](ai.md))                                                                             |
| `Questionnaire`, `Question`, `PollResponse`, `UserResponse`, `PathRecommendation` | **legacy, unused**: no `.objects` call outside migrations and commands                                                                               |

The onboarding questionnaire uses `onboarding/models.py` (`QuestionnaireVersion`,
`QuestionnaireProgress`). Its default structure lives in `onboarding/views.py`. Hearts are stored
on `UserProfile.hearts` / `hearts_last_refill_at` (`authentication/models.py`).

### Endpoints: `backend/education/urls.py` (all under `/api/`)

| Endpoint                                                                                                            | Purpose                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `paths/`, `courses/`, `lessons/`                                                                                    | catalogue. Writes are staff-only. Course list and retrieve are plan-checked      |
| `lessons/with_progress/`, `lessons/{id}/complete_section/`, `lessons/complete/`                                     | lesson-flow progress                                                             |
| `userprogress/flow_state/`, `userprogress/progress_summary/`, `userprogress/complete_course/`, `progress/complete/` | flow position and progress                                                       |
| `quizzes/?course=`, `quizzes/checkpoint/?lesson=`, `quizzes/complete/`                                              | capstone list, checkpoint, answer                                                |
| `exercises/`, `exercises/categories/`, `exercises/{id}/submit/`, `exercises/{id}/hint/`                             | practice catalogue and grading                                                   |
| `exercises/progress/{id}/`, `exercises/progress-batch/`, `exercises/reset/`                                         | attempt state, "Try Again"                                                       |
| `exercises/explain/`, `coach-brief/`                                                                                | AI (`education/views_ai.py`)                                                     |
| `review-queue/`, `mastery-summary/`, `whats-next/`, `next/`                                                         | spaced repetition, weak skills, next step                                        |
| `personalized-path/`, `personalized-path/refresh/`                                                                  | Personalized Path                                                                |
| `public/lessons/`, `public/lessons/{slug}/`                                                                         | public lessons (`education/views_public.py`)                                     |
| `user/hearts/`, `…/decrement/`, `…/grant/`, `…/refill/`, `…/practice/`                                              | hearts (`authentication/views_hearts.py`)                                        |
| `onboarding/…`                                                                                                      | questionnaire next/save/complete/abandon, `plan-summary/` (`onboarding/urls.py`) |

### Services and logic

- `backend/education/views.py` (3,444 lines). Nearly all learning logic is here:
  - path gating: `_allowed_path_ids`, `_user_can_access_path`
  - section, lesson and course completion and rewards: `_complete_section_for_user`,
    `_complete_lesson_for_user`, `_maybe_mark_course_complete`
  - mastery: `_grant_initial_mastery`, `_mastery_interval_days`, `_compute_weakness_score`
  - XP: `_compute_xp_delta`
  - review queue: `_review_queue_payload`
  - Personalized Path: `PersonalizedPathView`
- `backend/education/services/checkpoint_quizzes.py`: turns multiple-choice sections into checkpoint
  `Quiz` rows (`CHECKPOINT_MAX_QUESTIONS = 3`).
- `backend/education/services/public_lessons.py`: decides which lessons are public.
- `backend/education/exercise_visibility.py`: which exercises learners can see.
- `backend/education/tasks.py`: `decay_course_mastery`, translation jobs (`translate_*_async`) and
  embedding jobs. `backend/education/signals.py` queues translation and embedding jobs when content
  is saved.
- `backend/education/utils.py`: `resolve_path_access_tier`, `get_request_language`.
- `backend/education/serializers.py`: translation overlay and the English fallbacks.
- `backend/gamification/services/rewards.py`: XP and coin constants.
- `backend/authentication/entitlements.py`: `PLAN_MATRIX` (hints, ai_explain, personalized_path,
  ai_coach_brief per plan).
- `backend/authentication/services/hearts.py`, `backend/authentication/views_hearts.py`: hearts
  regeneration, refill cap, practice-to-earn.
- `backend/onboarding/views.py`, `backend/onboarding/plan_summary.py`: questionnaire and plan summary.

### Key screens

|                          | Web (`frontend/src/…`)                                                                            | Mobile (`mobile/…`)                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Topic and path browser   | `components/dashboard/Dashboard.tsx`, `components/courses/LearningPathList.tsx`, `CoursePage.tsx` | `app/(tabs)/learn.tsx`, `app/path/[id].tsx`, `app/course/[id].tsx`, `src/components/journey/JourneyMapContent.tsx` |
| Lesson flow              | `components/courses/CourseFlowPage.tsx` (2,303 lines, untested)                                   | `src/lesson/LessonFlowScreen.tsx` (1,474 lines), `app/flow/[id].tsx`, `app/lesson/[id].tsx`                        |
| Checkpoint               | `components/courses/LessonCheckpointQuizModal.tsx`                                                | `src/lesson/LessonCheckpointModal.tsx`                                                                             |
| AI help on wrong answers | `components/courses/LessonAIHelpModal.tsx`                                                        | `src/lesson/LessonAIHelpSheet.tsx`                                                                                 |
| Course quiz              | `components/courses/QuizPage.tsx`                                                                 | `app/quiz/[courseId].tsx`                                                                                          |
| Practice and review      | `components/exercises/ExercisePage.tsx` (3,131 lines) and per-type components                     | `app/(tabs)/exercises.tsx`, `src/components/exercises/*`, `src/components/lesson/ExerciseSection.tsx`              |
| Personalized Path        | `components/dashboard/PersonalizedPathContent.tsx`                                                | `app/personalized-path.tsx` (redirects to the Learn tab's personalized view)                                       |
| Onboarding               | `components/onboarding/OnboardingQuestionnaire.tsx`, `PlanReadyPage.tsx`                          | `app/onboarding.tsx`, `src/components/onboarding/PlanReadyScreen.tsx`                                              |
| Public and demo lesson   | `components/learn/LearnIndex.tsx`, `PublicLesson.tsx`                                             | `app/demo-lesson.tsx`                                                                                              |

Shared code: `packages/core/src/hooks/useHearts.ts`, `packages/core/src/services/*` (lesson, quiz,
exercise and AI services), and `packages/core/src/journey/journeyLayout.ts` (the journey map
layout). `heartsPracticeStatus.ts` is **duplicated** in `frontend/src/components/courses/` and
`mobile/src/lesson/` instead of being shared.

## Known gaps and flags

1. **Web cannot show numeric knowledge checks.** `CourseFlowPage.tsx` has renderers for
   drag-and-drop, multiple choice, budget allocation, fill-in-table and scenario simulation, but
   **not numeric**. The 13 numeric in-lesson checks (Real Estate cash-flow lessons, "How to Create
   a Simple Budget", "Income Tax & Tax-Free Allowances" and others) render as an empty box on web.
   The learner can only skip them. Mobile renders them (`NumericInput`).
2. **"3 core learning activities a day" for Starter is not built.** It appears in
   `docs/prod/subscription-matrix.md` and `docs/README.md`, but no code enforces or even
   defines it.
3. **The hint quota is not enforced, and the hint "cost" is not charged.** Starter's "2 hints a
   day" is never counted on the server (`check_and_consume_entitlement` is never called for
   `hints`). The web "5 coins" label is display only.
4. **Hearts work differently on each platform.** Mobile takes hearts for wrong course-quiz answers
   and web does not. Instant refills are free, so on Starter hearts slow learners down but rarely
   stop them.
5. **15 of 35 courses have no course quiz** (local DB), yet the web flow still sends learners to
   `/quiz/:courseId` at the end of the course. Each course that does have a "capstone" has a
   single question.
6. **Checkpoints repeat the lesson's own questions.** `generate_ai_checkpoint_questions` in
   `checkpoint_quizzes.py` can write new AI questions, but **nothing calls it**.
7. **Quizzes are English-only for Romanian users.** There are no `QuizTranslation` rows. There is
   also a hidden bug for when they are added: `quizzes/complete/` compares the chosen option text
   with the **English** `correct_answer`, so a learner choosing a translated option would always
   be marked wrong. 92 of 178 practice exercises are English-only too.
8. **The Personalized Path ignores its own ranking when displaying.** Courses are sorted in
   catalogue order, and reasons are per path. For Starter users the path makes an AI call every
   day and then locks 4 courses that are free anyway.
9. **The "Weekly" Coach Brief is regenerated daily** (24-hour cache). The README calls it weekly.
10. **Practice is not plan-gated.** Starter users can practise exercises from Pro-only topics, and
    the public `/learn` pages show the first lesson of Plus and Pro courses. The `/learn` behaviour
    is intentional. Whether practice should be gated has not been decided.
11. **Exercise types exist that no exercise uses.** No catalogue exercise is fill-in-table,
    scenario simulation or true/false, and no lesson uses budget allocation, fill-in-table or
    scenario simulation. The renderers exist on both platforms.
12. **Mastery has some odd edges.** Practice exercises stop at 90, so "Mastered" (95+) is
    reachable only through quiz questions. The `Mastery.legacy` migration is unfinished, so every
    query must filter `legacy=False` (26 of 46 local rows are legacy; debt-register #10).
13. **There are 900 `LessonSectionTranslation` rows with `language='en'`.** Today they match the
    base content exactly. But the serializer prefers a translation row over the base content, so
    if an editor changes a section's English base text, English learners will still see the old
    copy in the `en` row.
14. **The AI-help hint fallback passes a lesson-section id** to `exercises/{id}/hint/`, which looks
    up a _catalogue_ exercise id. The hint may come from an unrelated exercise or fail. It is used
    only when the explain call fails.
15. **The mobile exercises tab is hidden** (`href: null`). Learners reach it only through in-app
    links.
16. **Nothing here is behind a feature flag.** Learning features are gated only by plan. The
    flags that touch learning indirectly are `CIO_JOURNEY_EVENTS_ENABLED` (the coach-nudge email
    after mastery decay) and `UX_PAYWALL_PLACEMENT`.
17. **There are no tests for the two lesson-flow players** (`CourseFlowPage.tsx`,
    `LessonFlowScreen.tsx`).
