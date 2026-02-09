# Backend translation: centralize and automate

This document outlines how to centralize and automate translation of **backend-sourced content** (lessons, exercises, course copy, etc.) so that when you add new lessons or exercises in the future, they can be translated consistently.

---

## 1. Current situation

- **Frontend**: All UI strings are in `frontend/src/locales/{en,ro}/` (common.json, courses.json). The app uses `react-i18next` and `t("key")` everywhere. Language is chosen by the user and stored; API requests can send `Accept-Language`.
- **Backend**: Lesson text, section titles, exercise questions/options, and other content are stored in the database (or seed files) in a single language (e.g. English). The API returns this content as-is, so the same text is shown regardless of the user’s language.

**Gap**: Backend content (e.g. “What’s the ideal emergency fund size?”, “1 month of expenses”) is not translated. To support multiple languages for that content, the backend must either return localized strings or provide keys the frontend can translate.

---

## 2. Goals

- **Centralize**: One place (or a clear pattern) for how backend content is stored and translated.
- **Automate**: When you add new lessons/exercises (e.g. via admin or seed commands), translations can be created or updated with minimal manual work.
- **Consistent**: Same approach for lessons, exercises, and any other user-facing backend text.

---

## 3. Options (high level)

| Approach | Pros | Cons |
|----------|------|------|
| **A. Backend returns translated content** | Frontend stays simple; one API, no key lookups. | Backend must manage translations (DB or files), pass language (e.g. header/query), and resolve per request. |
| **B. Backend stores keys, frontend translates** | Backend stays language-agnostic; reuse frontend i18n. | Need a key scheme for all content; backend must expose keys (and fallback text if desired). |
| **C. Hybrid: backend translations + optional keys** | Can mix DB translations for dynamic content and keys for static copy. | Two mechanisms to maintain. |

**Recommendation**: Prefer **A** for lesson/exercise **body content** (so you can edit copy per language without code deploys). Use **B** only for small, stable labels that already live in the frontend (e.g. “Indicații”).

---

## 4. Recommended: backend returns translated content (Option A)

### 4.1 Language on the request

- Frontend already has current language (e.g. `en` / `ro`). Send it on every request that may return translatable content:
  - **Preferred**: `Accept-Language: ro` (or `en`).
  - **Alternative**: Query param or custom header, e.g. `X-App-Language: ro`.
- Backend reads this and uses it when loading lesson/exercise/course text.

### 4.2 Storing translations in the backend

**Option A1 – Same table, one row per language**

- Tables like `Lesson`, `LessonSection`, `Exercise` (or whatever holds the content) get a `language` (or `locale`) column.
- Each “logical” lesson has one row per language (e.g. `lesson_id=5` + `language=en` and `lesson_id=5` + `language=ro`).
- When you add a new lesson, you add rows for each supported language (manually or via a script).

**Option A2 – Separate translation tables**

- Keep one “canonical” row per lesson/section/exercise (e.g. in English).
- Add tables such as `LessonTranslation`, `LessonSectionTranslation`, `ExerciseTranslation` with columns like: `lesson_id`, `language`, `title`, `body`, etc.
- API loads the row for the requested language; if missing, fall back to the canonical language.

**Option A3 – JSON translation column**

- One row per lesson/section/exercise; add a column like `translations` (JSONB):
  - `{"en": {"title": "...", "body": "..."}, "ro": {"title": "...", "body": "..."}}`.
- Good for small, fixed sets of languages and when you don’t need to query by translated text.

**Recommendation**: A2 (translation tables) scales best and keeps schema clear. A3 is fine for a small app and few languages.

### 4.3 API behavior

- Endpoints that return lessons, sections, exercises (and any other translatable content):
  - Read `Accept-Language` (or your chosen header/param).
  - Normalize to a supported locale (e.g. `en`, `ro`).
  - Load content for that locale (from translation table or JSON); if missing, fall back to default (e.g. `en`).
  - Return the same JSON shape as today, but with translated `title`, `body`, `question`, `options`, etc.

No change to frontend beyond ensuring it sends the current language.

### 4.4 Seeding and “automation”

- **Seed data**: When you add new lessons/exercises via Django fixtures or management commands:
  - Create the canonical record (e.g. English).
  - Create corresponding translation rows (or JSON entries) for the other languages.
- **Automation ideas**:
  - **Script**: After inserting new English lesson/section/exercise, script (or management command) creates empty or placeholder translation rows for `ro` (and others), so translators only fill them.
  - **Optional MT**: A step that calls a translation API (e.g. DeepL, Google Translate) to fill `ro` from `en`, then humans review.
  - **Admin**: Django admin (or a small internal UI) with filters by language and inline editing of translation tables so new content can be translated without touching code.

---

## 5. Alternative: backend exposes keys, frontend translates (Option B)

Use this only for a small set of stable strings you’re happy to keep in the frontend.

- Backend stores a **translation key** (e.g. `lessons.emergency_fund.title`) instead of or in addition to raw text.
- API returns e.g. `{"title_key": "lessons.emergency_fund.title", "title_fallback": "Emergency fund"}`.
- Frontend uses `t(title_key)` and falls back to `title_fallback` if the key is missing.

**Automation**: When you add a new lesson, you add the same key to `frontend/src/locales/en/*.json` and `ro/*.json` (or a shared backend-owned JSON that the frontend loads). You can generate the key from a slug (e.g. `lessons.{slug}.title`).

**Downside**: All translatable backend content must be keyed and duplicated in frontend (or a shared) locale files; less convenient for long or frequently edited copy.

---

## 6. Practical steps (Option A – backend translated content)

1. **Backend**
   - Add translation storage (translation tables or JSON column per model).
   - Add `Accept-Language` (or header/param) handling and a small helper: “given model + id + language, return translated fields or fallback.”
   - Update lesson/section/exercise serializers and views to return translated content based on request language.
2. **Frontend**
   - Ensure API client sends `Accept-Language: <currentLocale>` (from i18n) on relevant requests.
   - No need to change how response fields are rendered; they’re already translated.
3. **Content workflow**
   - When adding a new lesson: create canonical row + translation rows (or entries) for each language.
   - Prefer a management command or admin flow so “add lesson” always creates placeholders for all locales; optionally add an MT step for first draft, then human review.

---

## 7. Summary

- **Centralize**: Keep all backend-driven copy in the backend (canonical + translations), and use one mechanism (e.g. translation tables + `Accept-Language`).
- **Automate**: On “add lesson/exercise”, automatically create translation rows/placeholders for every supported language; optionally auto-fill via machine translation and then review in admin.
- **Frontend**: Only needs to send current language and keep translating its own UI with existing locale files; backend handles the rest of the copy.

This keeps the frontend translation work you’ve already done for UI, and makes backend content (lessons, exercises, etc.) translatable and scalable as you add more lessons in the future.
