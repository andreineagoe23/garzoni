# AI features

> Garzoni uses OpenAI for a chat tutor, explanations when a learner gets a question wrong,
> personalised learning-path reasons, a weekly coach note, a one-line "do this next" prompt on the
> mobile home screen, a Personal CFO coach and narrative, statement insights, a voice tutor and a
> receipt scan. Every plan uses the same chat model (`gpt-4.1-mini` by default). Plans differ only
> in **how many** AI calls a user gets per day and **which** features are switched on. Voice and
> receipt scan are Pro-only and exist only in the mobile app. AI push nudges are built but switched
> off. Lesson search ("RAG") works, but it embeds only titles and short descriptions and does not
> use pgvector.

_Last reviewed: 2026-10-08, against `master` at `d431e781`._

## At a glance

| Feature                                          | Web                                        | Mobile                       | Plan                                                                 | Model (default)                                     | Status                                          |
| ------------------------------------------------ | ------------------------------------------ | ---------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Chat tutor, with tools                           | ✅ floating chat widget                    | ✅ full `chat` screen        | All. 5 / 50 / 200 messages a day                                     | `gpt-4.1-mini`                                      | Shipped                                         |
| Explain a wrong answer, plus a practice question | ✅ lesson flow                             | ✅ lesson flow               | Starter 3 a day; Plus/Pro unlimited                                  | `gpt-4.1-mini`                                      | Shipped                                         |
| Exercise feedback on submit                      | ✅                                         | ✅                           | All, no quota                                                        | `gpt-4.1-mini`                                      | Shipped                                         |
| Progressive hint                                 | ✅ (fallback inside AI help)               | ✅ (fallback inside AI help) | All, **no quota**                                                    | `gpt-4.1-mini`                                      | Shipped                                         |
| Personalised path ranking and reasons            | ✅                                         | ✅                           | Ranking runs for everyone; Starter sees only the first tile unlocked | `gpt-4.1-mini`                                      | Shipped                                         |
| Weekly Coach Brief                               | ✅ on the Personalised Path page           | ✅ same page                 | Plus/Pro                                                             | `gpt-4.1-mini`                                      | Shipped                                         |
| Smart Resume (home-screen one-liner)             | ❌                                         | ✅                           | All, no quota                                                        | `gpt-4.1-nano`                                      | Shipped (mobile only)                           |
| "What does this mean?" in tools                  | ✅ Goals Reality Check, Portfolio Analyzer | ✅ Portfolio                 | Uses the chat tutor quota                                            | `gpt-4.1-mini`                                      | Shipped                                         |
| Personal CFO coach (chat)                        | ✅ panel in the CFO dashboard              | ✅ `personal-cfo-coach` tool | Plus/Pro, and uses the chat tutor quota                              | `gpt-4.1-mini`                                      | Shipped                                         |
| Personal CFO narrative                           | ✅                                         | ✅                           | Plus/Pro (Starter gets a fixed, non-AI text)                         | `gpt-4.1-nano`                                      | Shipped                                         |
| Statement AI insight (3 bullets)                 | ✅ statement import                        | ✅ statement import          | Shares the "explain" quota: Starter 3 a day                          | `gpt-4.1-nano`                                      | Shipped                                         |
| Voice tutor                                      | ❌                                         | ✅ via chat header button    | Pro                                                                  | `gpt-4o-mini-transcribe` → `gpt-4.1-mini` → `tts-1` | Shipped (mobile only)                           |
| Receipt / statement photo scan                   | ❌                                         | ✅ Tools hub "Receipt Scan"  | Pro, 5 a day                                                         | `gpt-4.1-mini` (vision)                             | Shipped (mobile only, in the 1.2.0 store build) |
| Lesson search (RAG)                              | used by tutor and scan                     | used by tutor and scan       | n/a                                                                  | `text-embedding-3-small`                            | Partial                                         |
| AI push nudges                                   | —                                          | —                            | —                                                                    | `gpt-4.1-mini`                                      | **Switched off**                                |
| Post-practice "session debrief"                  | ❌                                         | ❌                           | —                                                                    | —                                                   | Endpoint exists, nothing calls it               |
| AI-written checkpoint questions                  | —                                          | —                            | —                                                                    | —                                                   | Code exists, nothing calls it                   |

## How it works (user's view)

### Chat tutor

**Where.** On web, a floating chat widget is mounted on most app pages. It is hidden on course
lesson flows, some excluded paths, and legal pages for signed-out visitors
(`frontend/src/routes/AppShell.tsx:93-95`). Web has no dedicated chat page. On mobile, chat is a
full screen (`mobile/app/chat.tsx`).

**What it does.** The tutor is a short-answer finance tutor that teaches by asking questions. The
system prompt tells it to answer in 3–5 sentences, never give away an exercise answer, give hints
step by step, and suggest a related lesson (`backend/support/prompts/tutor.py`, `TUTOR_SYSTEM`).
Each turn, the server also adds a short note about the learner to the prompt: their top 3 skills,
the course they are on, how many courses they have finished, and their onboarding goal and biggest
challenge (`support/services/openai.py`, `_build_education_context`).

**Tools it can call.** The model decides when to call these. The server runs them and gives the
results back to the model, for up to 4 rounds per message (`_MAX_TOOL_ROUNDS`).

| Tool                         | What it reads                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_user_progress`          | Streak, number of completed courses, most recent course and its path (`UserProfile.streak`, `UserProgress`)                                                                     |
| `get_weak_skills`            | The lowest-proficiency skills (`Mastery`), 5 by default                                                                                                                         |
| `get_financial_profile`      | Profile fields `goal_types`, `timeframe`, `risk_comfort`, `income_range`, `savings_rate_estimate`, `investing_experience`, plus onboarding `primary_goal` / `biggest_challenge` |
| `recommend_next_lesson`      | The first unfinished course in `UserProfile.recommended_courses`, or failing that the weakest skill                                                                             |
| `generate_practice_question` | Nothing from the database. A second model call writes one multiple-choice question as JSON                                                                                      |
| `lookup_lesson`              | Semantic search over the lesson library (see [Lesson search](#lesson-search-rag)). If that fails, a match on lesson titles                                                      |

All six live in `backend/support/services/tools.py`. The CFO coach has a separate set of six
tools, described below.

**Shortcuts that skip the model.** If the message is exactly a greeting ("hi", "hello"…), the
server replies with a fixed English line. Messages containing "reset", "start over", "new chat" and
similar archive the conversation. Both checks run **after** the daily quota is charged, so a "hi"
uses one of the day's messages (`support/services/openai.py`, `handle`). Both chat clients also
answer some stock, forex, crypto and date questions themselves, from market data, without calling
the AI (`frontend/src/components/widgets/Chatbot.tsx:282-395`, `mobile/app/chat.tsx`).

**History.** Conversations are saved on the server, one active conversation per user per
`source` (`chat`, `exercise_hint`, `voice`, `cfo_coach`, …). The web widget reloads the last 50
messages from the server when it opens. The mobile app shows history from local device storage
(`AsyncStorage`). The server still sends its saved history to the model, so the tutor
"remembers" across devices even though the mobile screen does not show earlier messages from
another device.

**From a lesson.** On mobile, opening chat from an exercise pre-fills the first message and sends
the question and the learner's answer as `exercise_context`. The tutor is then told to give a
hint and not the answer. That conversation is stored under `source="exercise_hint"`.

**Safety and disclaimers.** The tutor prompt is about teaching method. It does **not** include a
"not financial advice" rule. That rule appears only in the CFO coach prompt, the CFO narrative
prompt and the statement-insight prompt. The app does not filter model output.

**Romanian.** The tutor does not receive the user's app language. Nothing in the prompt says
which language to reply in, so a Romanian reply happens only when the model mirrors the user's
language. The greeting and reset replies are hard-coded in English. The client-side UI strings are
translated (en/ro).

### Explain a wrong answer, with a follow-up practice question

In a lesson, the second wrong attempt on an exercise opens an AI help sheet
(`frontend/src/components/courses/CourseFlowPage.tsx:1129-1145`,
`mobile/src/lesson/LessonAIHelpSheet.tsx`). The sheet calls `POST /api/exercises/explain/`. That
returns a short explanation in the tutor's question-led style (at most 4 sentences, ending with a
check question). If the exercise has a skill tag, it also returns a newly written practice
question on that skill. The question's difficulty is based on the learner's proficiency. When the
Starter quota of 3 a day runs out, the sheet falls back to a hint (below), then to fixed text.
The learner never sees an upsell in the middle of a lesson
(`packages/core/src/services/aiTutor.ts`, `ExerciseExplainQuotaError`).

Both clients send `userAnswer: ""`, so the model does not see what the learner actually answered.
The explanation is based on the question and the correct answer only.

### Exercise feedback and hints

- **Feedback on submit.** When a practice exercise is answered wrongly and has no written
  feedback, the submit endpoint asks the model for 2–3 sentences of feedback
  (`education/views.py:2276`). This call has a 3-second timeout. If it fails, the learner sees a
  fixed "Not quite" line. It does not count toward any quota.
- **Hints.** `POST /api/exercises/{id}/hint/` returns a hint that gets more specific with each
  attempt, with fixed fallback text. The app uses it only as the fallback inside the AI help sheet
  (with attempt number 2). It has a 3-second timeout and **does not charge the `hints`
  entitlement**. Nothing in the codebase charges that entitlement.

### Personalised Path ranking and reasons

On the Personalised Path page the server ranks learning paths for the user. It sends the
onboarding answers, a summary of strong and weak skills, and the list of paths, and asks the model
for a ranked JSON list with a one-sentence reason for each path. Those reasons are stored per
course (`PathPlan.reason`) and shown on the course tiles. If the model fails, the server ranks by
keyword weights and the tiles show fixed reasons. The ranking runs for **all** plans. On Starter,
every tile after the first is locked behind an upgrade (`education/views.py:3075-3091`).

The ranking is regenerated on request, when it is a day old, when a recommended course is
finished, or when nothing in it is still available. The model is not called again if a hash of
the inputs (answers + mastery) is unchanged (`education/views.py`,
`generate_recommendations` / `_input_hash`).

### Weekly Coach Brief

A three-paragraph note of under 200 words: what you did this week, what to focus on next, and one
small goal. It is built from courses finished in the last 7 days, the current streak, the 3
weakest skills, recommended courses and the onboarding goal. It appears as a card at the top of
the Personalised Path page on both platforms (Plus/Pro). `GET /api/coach-brief/` keeps the brief
for 24 hours per user. It is generated when someone opens the page, not sent on a schedule.
Starter users get a 402 and the card does not appear. Each request that misses the 24-hour cache
counts as one `ai_coach_brief` use, but Plus/Pro have no limit on that.

### Smart Resume (mobile home screen)

`GET /api/smart-resume/` returns one suggestion of at most 12 words ("what to do next") built
from the streak, current course and weak skills. This is the **only** AI feature that is
explicitly language-aware: it has separate English and Romanian prompts and caches each language
separately. Details:

- The suggestion is cached for 24 hours.
- The call has an 8-second timeout and no retries.
- After a failure, that user gets nothing for 10 minutes.
- An out-of-credit response from OpenAI turns the feature off for **all** users for 1 hour.

It runs on every plan with no quota. Only the mobile home screen requests it
(`mobile/app/(tabs)/index.tsx:241`).

### "What does this mean?" in tools

Goals Reality Check and Portfolio Analyzer on web, and Portfolio on mobile, have a button that
writes a prompt from the tool's numbers and sends it to the **chat tutor**
(`requestAiTutorResponse` → `/proxy/openai/`, `source="chat"`). Each use counts as one chat
message and is added to the user's chat history.

### Personal CFO: coach and narrative

This page covers only the AI parts. The CFO tool itself is documented separately.

- **CFO coach** (`POST /api/personal-cfo/coach/`) is a chat about the user's own money. It uses
  the same chat service with `source="cfo_coach"`, a separate system prompt (`CFO_COACH_SYSTEM`)
  and six separate tools:
  - `get_net_worth`
  - `get_portfolio_summary`: real holdings only, not paper trades. Includes a diversification
    score based on the HHI concentration index.
  - `get_financial_goals`: includes months to each goal at the current saving pace.
  - `get_spending_summary`: this month's income, spending and categories against budget.
  - `run_projection`: compound growth.
  - `run_scenario`: extra savings, or a market drop.

  The prompt rules out regulated advice and picking securities, and tells the model to reply in
  the user's language. Access requires Plus/Pro, and each message also counts against the chat
  tutor quota. It is on **both** platforms: `frontend/src/components/tools/CFOCoachPanel.tsx`
  (opened from `CFODashboard`) and `mobile/app/tools/personal-cfo-coach/`.
  `.claude/context/feature-status.md` lists it as mobile-only. That entry is out of date.

- **CFO narrative.** The dashboard paragraph (120–180 words) is written by `gpt-4.1-nano` in a
  Celery task, never while the user waits. It is cached for 6 hours under a hash of the numbers
  that feed it. While it is being written, the page shows a fixed text and polls
  `/personal-cfo/narrative/`. Starter users, and environments with no API key, always get the
  fixed text (`budgeting/services/dashboard.py:415-500`).

### Statement AI insight

After a statement import, `POST /api/budgeting/statements/insight/` returns three bullets: the
main pattern, where to cut, and one action for next month. The model sees **only category totals
and ratios**. The server rebuilds the prompt from validated numbers, so merchant names and
transaction text never leave the server (`budgeting/services/statement_ai.py`). Categorising the
transactions is rule-based and done entirely on the server, without AI
(`budgeting/services/categorization.py:1-12`). The insight shares the `ai_explain` quota, so a
Starter user's 3 a day are split between lesson explanations and statement insights.

### Voice tutor (Pro, mobile only)

On the mobile chat screen, a header button opens `voice-chat` (`mobile/app/chat.tsx:604`).
Non-Pro users see a locked screen. Recorded audio is sent to `POST /api/voice-tutor/` (25 MB
maximum). It is transcribed with `gpt-4o-mini-transcribe` and answered by the normal chat tutor
(`source="voice"`, with all the tools). The reply is spoken back with `tts-1`, voice "nova". Each
voice turn charges `ai_voice` (unlimited on Pro) **and** one chat tutor message, because the
handler calls the full chat service (`support/views_voice.py:91-110`). There is no web version.

### Receipt / statement scan (Pro, mobile only)

The "Receipt Scan" tile in the mobile Tools hub opens `app/scan.tsx`
(`mobile/src/components/tools/mobileToolsRegistry.ts:79-87`). The user picks an image from their
photo library. The app never opens the camera. `POST /api/scan/` sends the image to
`gpt-4.1-mini` with vision at `detail: "low"`. The model returns JSON with:

- spending categories, with amounts, percentages and an emoji
- a one-line insight
- a money tip
- a search query

The server runs that query through lesson search to suggest up to 2 lessons or courses. Pro only,
5 scans a day; non-Pro users see a locked screen. The tile was added in `cf275c38` (2026-08-18).
That commit is part of the 1.2.0 store build, so the feature is reachable in the shipped app.
There is no web version.

### Lesson search (RAG)

Lesson search powers the tutor's `lookup_lesson` tool and the scan's lesson suggestions. It works
like this:

- **What is embedded.** Only a short line per lesson or course: the title, short description and
  course/path name. Full lesson content is not embedded. A model signal re-embeds a lesson or
  course when it is saved (`education/signals.py:80-96` → `embed_lesson_async` /
  `embed_course_async`). `backfill_embeddings_async` fills in anything missing. The code can also
  embed skills (`index_skill`), but nothing calls it.
- **Model.** `text-embedding-3-small`, 1536 dimensions. This is hard-coded in
  `education/services/retrieval.py`, not set from an env var.
- **Search.** The query is embedded, then **every** stored vector is loaded from
  `ContentEmbedding` (a JSON field) and scored in a Python loop using cosine similarity. pgvector
  is a pinned dependency but is not used.

### AI push nudges (switched off)

`send_ai_nudge_task` writes a push of at most 120 characters from the streak, weakest skill and
plan, and sends it through Customer.io. If the user has no device, it falls back to email. The
daily batch was turned off on 2026-05-30 after complaints about email spam:

- the beat entry was removed (`settings/celery.py:74-78`)
- the DB `PeriodicTask` was disabled (migration `authentication/0025`)
- `send_ai_nudges_batch` does nothing unless `AI_NUDGES_BATCH_ENABLED` is set, and no settings
  file defines it (`notifications/tasks.py:573`)

No other notification uses AI-written text.

## Plans, quotas and models

Quotas come from `PLAN_MATRIX` in `backend/authentication/entitlements.py`. They are counted per
user per calendar day in the Django cache, using the server's day (`timezone.now().date()`), not
the user's timezone. Pro's `ai_tutor: 200` is also restated in `PLAN_CATALOG.feature_overrides`.

| Entitlement         | Starter               | Plus      | Pro       | Charged by                                                     |
| ------------------- | --------------------- | --------- | --------- | -------------------------------------------------------------- |
| `ai_tutor`          | 5 a day               | 50 a day  | 200 a day | chat, tools' "what does this mean", CFO coach, each voice turn |
| `ai_explain`        | 3 a day               | unlimited | unlimited | lesson explanations **and** statement insights                 |
| `ai_coach_brief`    | off                   | unlimited | unlimited | coach brief requests that miss the cache                       |
| `personalized_path` | off (first tile only) | on        | on        | not charged; it only locks tiles                               |
| `personal_cfo`      | off                   | on        | on        | the CFO coach also checks the plan directly                    |
| `ai_voice`          | off                   | off       | unlimited | voice tutor                                                    |
| `ai_scan`           | off                   | off       | 5 a day   | receipt scan                                                   |
| `hints`             | 2 a day (stated)      | unlimited | unlimited | **nothing**; the hint endpoint never checks it                 |

On top of these, the chat service has a **daily token budget** per user: 50,000 tokens on Starter
and 500,000 on Plus/Pro (`OPENAI_DAILY_TOKEN_BUDGET_FREE` / `_PREMIUM`). It resets at midnight
UTC. Request-rate throttles also apply: chat is limited to 30/min on Starter and 120/min on
Plus/Pro, and the voice and scan upload endpoints to 60/hour (`support/throttles.py`).

**Models.** Every plan uses the same model. Pro used to get `gpt-4o` and others `gpt-4o-mini`;
that split was removed, and the whole app moved to the gpt-4.1 family in 2026-08
(`settings/settings.py:483-505`, `support/services/openai.py:47-52`). Each tier is set by an env
var:

| Setting                   | Default                  | Used for                                                                                                                                              |
| ------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_MODEL_ASSISTANT`  | `gpt-4.1-mini`           | chat tutor, CFO coach, voice answers, explain, feedback, hints, path ranking, coach brief, practice questions, receipt vision, RO content translation |
| `OPENAI_MODEL_EXTRACTION` | `gpt-4.1-nano`           | Smart Resume, CFO narrative, statement insight, conversation summaries                                                                                |
| `OPENAI_MODEL_AUTHORING`  | `gpt-4.1`                | offline content-rewrite management commands only                                                                                                      |
| `OPENAI_MODEL_TRANSCRIBE` | `gpt-4o-mini-transcribe` | voice transcription                                                                                                                                   |
| `OPENAI_MODEL_TTS`        | `tts-1`                  | voice reply                                                                                                                                           |
| (hard-coded)              | `text-embedding-3-small` | lesson search                                                                                                                                         |

gpt-5 models are deliberately not used, because the call sites pass `max_tokens` and `temperature`
(`settings.py:492-495`).

## Under the hood

**API key.** Every call uses one key, `OPENAI_API_KEY`. No organisation or project env var
exists. Which OpenAI project the key belongs to is decided on OpenAI's side, not in code. Content
translation is on by default only when a key is set (`CONTENT_TRANSLATION_ENABLED`).

**Endpoints.**

| Endpoint                                      | View                                                          | Feature                                        |
| --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `POST /api/proxy/openai/`                     | `support/views_openai.py` `OpenAIProxyView`                   | chat tutor                                     |
| `GET /api/conversation/history/`              | `ConversationHistoryView`                                     | web chat scrollback                            |
| `POST /api/conversation/session-debrief/`     | `SessionDebriefView`                                          | saves a debrief prompt; **no client calls it** |
| `POST /api/voice-tutor/`                      | `support/views_voice.py`                                      | voice                                          |
| `POST /api/scan/`                             | `support/views_scan.py`                                       | receipt scan                                   |
| `GET /api/smart-resume/`                      | `support/views_smart_resume.py`                               | Smart Resume                                   |
| `POST /api/exercises/explain/`                | `education/views_ai.py` `ExerciseExplainView`                 | explain                                        |
| `GET /api/coach-brief/`                       | `education/views_ai.py` `CoachBriefView`                      | coach brief                                    |
| `POST /api/exercises/{id}/hint/`, `…/submit/` | `education/views.py` `ExerciseViewSet`                        | hints, feedback                                |
| `GET /api/personalized-path/` (+ `refresh/`)  | `education/views.py` `PersonalizedPathView`                   | path ranking                                   |
| `GET/POST /api/personal-cfo/coach/`           | `budgeting/views.py` `PersonalCfoCoachView`                   | CFO coach                                      |
| `GET /api/personal-cfo/narrative/`            | `budgeting/views.py` → `services/dashboard.resolve_narrative` | CFO narrative                                  |
| `POST /api/budgeting/statements/insight/`     | `budgeting/views_statements.py`                               | statement insight                              |

**Services and prompts.**

- `backend/support/services/openai.py` — `OpenAIService`, the shared chat loop. It handles:
  - idempotency keys (results cached for `OPENAI_IDEMPOTENCY_TTL_SECONDS`, 120 s by default; a
    duplicate in flight gets 409)
  - quota and token-budget checks
  - the tool loop
  - saving messages
  - rolling summaries
- `backend/support/services/tools.py` — the tutor and CFO tool schemas and their dispatchers.
- `backend/support/prompts/tutor.py` — all tutor, explain, feedback, hint, path, quiz, coach
  brief, nudge, practice-question and CFO coach prompts (`PROMPT_VERSION = "v3"`). Prompts for
  scan, Smart Resume, statement insight and CFO narrative are written inline in their own
  modules.
- `backend/education/services/ai_tutor.py` — single-shot helpers (`_post`) with fixed timeouts:
  - 3 s for feedback and hints
  - 15 s for nudges
  - 180 s for path ranking, coach brief, explain and checkpoints

  None of them retry.

- `backend/education/services/retrieval.py` — embeddings and search.
- `backend/budgeting/services/statement_ai.py`, `budgeting/services/dashboard.py` — CFO and
  statement AI.
- `backend/education/services/translation.py` — OpenAI-backed translation of curriculum content
  into Romanian (an authoring-side job, not a user-facing feature).

**Storage.** `support.models.Conversation` (`core_ai_conversation`: user, source, summary,
total_tokens) and `Message` (`core_ai_message`: role, content, tool_call_id, tool_name).
Tool-result rows are saved but removed before history is sent back to the model. Once a
conversation passes 3,000 tokens, a `gpt-4.1-nano` call writes a 3–5 sentence summary, and the
conversation is cut back to its latest 40 messages. "Reset" archives a conversation by renaming
its source to `<source>_archived`. `ContentEmbedding` holds the lesson-search vectors.
`PathPlan.reason` holds the AI reasons for path tiles.

**Background tasks.**

- `budgeting.tasks.generate_cfo_narrative_task`: one at a time per user, behind a
  `cfo_ai_lock:<id>` lock.
- `education.tasks.embed_lesson_async` / `embed_course_async` / `backfill_embeddings_async`.
- `notifications.tasks.send_ai_nudge_task` / `send_ai_nudges_batch`: switched off.

**Cost controls, in one place.**

- Per-plan daily quotas (`check_and_consume_entitlement`) and the daily chat token budget.
- Request throttles: chat 30 or 120 per minute; voice and scan uploads 60 per hour.
- Input limits:
  - prompts over 4,000 characters are rejected (`OPENAI_MAX_PROMPT_CHARS`)
  - chat replies are capped at 512 tokens (`OPENAI_MAX_TOKENS`)
  - voice uploads are capped at 25 MB and images at 20 MB
  - scan images are sent at `detail: "low"`
- Caches:
  - coach brief: 24 h
  - Smart Resume: 24 h per language
  - CFO narrative: 6 h, keyed by a hash of its inputs
  - path ranking: skipped when the input hash is unchanged
- Smart Resume backs off for 10 minutes after a failure, and for 1 hour, for all users, when the
  account is out of credit.
- Fallbacks that need no model, for every user-facing call: fixed feedback, hint, path-reason and
  CFO-narrative text.
- The statement insight sends numbers only, so its prompts stay small.

## Known gaps and flags

- **The README is out of date on models.** It says `gpt-4o-mini` for Free/Plus and `gpt-4o` for
  Pro, Whisper for voice, and "GPT-4o vision" for scan. The code uses `gpt-4.1-mini` for every
  plan, `gpt-4o-mini-transcribe` for voice and `gpt-4.1-mini` for scan. `docs/dev/environment.md`
  still says the `OPENAI_ALLOWED_MODELS_CSV` default includes `gpt-4o-mini,gpt-4o`. The real
  default is `gpt-4.1-nano, gpt-4.1-mini, gpt-4.1`.
- **The README is out of date on RAG.** "All lesson and course content is embedded" is not true.
  Only a title-and-description line is embedded, it is stored as JSON, and search is a Python
  loop over every row. pgvector is not used.
- **The README says AI push nudges are live.** They have been switched off since 2026-05-30.
- **No language handling except Smart Resume.** The tutor, explain, feedback, hints, path reasons
  and coach brief never receive the user's locale. The coach brief cache key ignores language. The
  greeting and reset replies are English-only.
- **Chat quota is charged before the free shortcuts run.** A "hi" or "reset" uses one of the
  Starter user's 5 daily messages.
- **Voice is charged twice:** `ai_voice` plus one `ai_tutor` message per turn. The code comment
  says "Temporarily mark already consumed so service doesn't double-charge", but nothing does
  that. Each request also writes the audio to a temp file with `delete=False` and never deletes
  it.
- **Tool use counts against the chat quota.** The "what does this mean?" buttons in tools and the
  CFO coach both use the chat tutor quota. The tool prompts also end up in the user's chat
  history.
- **Explain never sees the learner's answer.** Both clients send `userAnswer: ""`.
- **`hints` entitlement (Starter 2 a day) is never enforced.** The hint endpoint has no quota.
- **The practice-question tool will usually time out.** When called from the chat
  (`generate_practice_question`), it uses `_post`'s default 3-second timeout for a 400-token
  JSON answer. The explain flow passes 180 s.
- **Summaries run again on every turn once a conversation passes 3,000 tokens.** `total_tokens`
  never resets after summarising, so every later turn makes an extra summary call.
- **Web scrollback shows tool-call placeholders.** `get_conversation_history` returns placeholder
  assistant rows such as `[tool calls: lookup_lesson]`, and the web widget shows them as bot
  messages.
- **Mobile chat history is per device.** The screen shows local history only, while the server
  keeps (and the model sees) the full conversation.
- **The tutor prompt has no "not financial advice" rule.** Only the CFO and statement prompts
  have one.
- **Unreachable or dead code:**
  - the `session-debrief` endpoint (no caller)
  - `chat_stream` (no caller)
  - `generate_ai_checkpoint_questions` (no caller)
  - `index_skill` (no caller)
  - `OPENAI_CACHE_TTL_SECONDS`, `OPENAI_MAX_MESSAGES` and `OPENAI_MAX_MESSAGE_CHARS` are defined
    in settings but never read
- **Platform gaps.** Voice and scan are mobile-only. Smart Resume is mobile-only. The scan uses
  the photo library only and never the camera (camera permission was dropped in 1.2.1).
- **`.claude/context/feature-status.md` is out of date** in two places:
  - it says the web chat is "embedded in `CFODashboard`"; it is actually a global floating widget
    in `AppShell`
  - it lists the CFO coach as mobile-only; it is on web too, as `CFOCoachPanel`
- **Untested.** Feature-status records the CFO dashboard, narrative and coach endpoints as having
  no tests.
