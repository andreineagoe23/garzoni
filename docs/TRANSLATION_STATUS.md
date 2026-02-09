# Translation implementation – status and next steps

## What’s implemented

### Backend (education app only)

| Area | What was done |
|------|----------------|
| **Language detection** | `education/utils.py`: `get_request_language(request)` reads `X-App-Language`, then `Accept-Language`, normalizes to 2-letter code, returns `en` or `ro` (else `en`). |
| **Translation models** | `education/models.py`: `PathTranslation`, `CourseTranslation`, `LessonTranslation`, `LessonSectionTranslation`, `QuizTranslation`, `ExerciseTranslation`. Each has FK to parent, `language` (indexed), same text/JSON fields as the main model. `unique_together = [("parent", "language")]`. |
| **Migration** | `education/migrations/0014_add_translation_models.py` – creates the six translation tables. Run: `python manage.py migrate education`. |
| **Serializers** | `education/serializers.py`: All path/course/lesson/section/quiz/exercise serializers use `get_request_language()` and `_get_translation()` in `to_representation()` so API responses are in the requested language. |
| **Views** | Path, Course, Lesson (with progress), Quiz, Exercise views prefetch `translations` (and nested where needed) to avoid N+1. |
| **Admin** | `education/admin.py`: TabularInlines for all six translation models on their parent ModelAdmins so staff can edit translations in Django admin. |
| **Backfill command** | `education/management/commands/backfill_translations.py`: Creates EN rows from canonical content, then RO rows (copy from EN or canonical). Run: `python manage.py backfill_translations` (optionally `--dry-run` first). |
| **CORS** | `settings/settings.py`: `x-app-language` and `accept-language` added to `CORS_ALLOW_HEADERS` so the browser allows the frontend to send them. |

**Not translated on backend (yet):** Missions, FAQ, rewards/shop/donate item names, subscription plan copy – these endpoints do not use `get_request_language()` or translation tables.

---

### Frontend

| Area | What was done |
|------|----------------|
| **i18n setup** | `src/i18n.ts`: i18next with `en`/`ro`, initial language from `localStorage` then browser, `document.documentElement.lang` updated, language persisted to `localStorage`. |
| **Constants** | `src/constants/i18n.ts`: `DEFAULT_LANGUAGE`, `SUPPORTED_LANGUAGES`, `LANGUAGE_STORAGE_KEY`. |
| **Locale files** | `src/locales/en/` and `src/locales/ro/`: `common.json`, `courses.json`, `shared.json`, `index.ts`. |
| **Language selector** | Navbar (and any existing selector) – user can switch EN/RO. |
| **API language headers** | `src/services/httpClient.ts`: every request sends `Accept-Language` and `X-App-Language` from `i18n.language`. |
| **Content APIs use apiClient** | So backend receives language: AllTopics (paths), PersonalizedPath, ExercisePage, Missions, FAQPage, QuizPage, ShopItems, DonationCauses. |
| **Profile balance** | Shown as number + “coins”/“monede” (no USD). |
| **Referral block** | ReferralLink: all copy via `t("profile.referral.*")`. |
| **Shop / Donate** | ShopItems & DonationCauses: titles, subtitles, empty states, “Buy Now”, “X coins” use `t()` and `rewards.coins` / `rewards.shop.*` / `rewards.donate.*`. |
| **Tools hub** | `tools.groups.*` and `tools.entries.*` for section titles and tool title/promise; ToolsPage uses `t()` with fallback to registry. |
| **New locale keys (EN + RO)** | `rewards.shop.*`, `rewards.donate.*`, `profile.referral.*`, `tools.groups.*`, `tools.entries.*`. |
| **Browser translation off** | `public/index.html`: `<meta name="google" content="notranslate">` and `<html translate="no">` so only the app controls language. |

**Still using raw axios (no language headers) in some places:** e.g. AuthContext (login/register/refresh), PortfolioAnalyzer, Chatbot, SubscriptionManager, some profile/settings calls – those endpoints don’t return translated content yet, so this is acceptable until you add backend translation for them.

---

## What’s left / next steps

### 1. Backend – education content in Romanian

- **Run migration** (if not already):
  `cd backend && python manage.py migrate education`
- **Run backfill**:
  `python manage.py backfill_translations`
  Then in Django admin, replace the RO rows (currently copied from EN) with real Romanian for paths, courses, lessons, sections, quizzes, exercises.

### 2. Backend – missions

- **If** mission titles/descriptions/reasons are stored in the DB (e.g. in `gamification` or similar):
  - Add a translation model (e.g. `MissionTranslation` or per-template translations).
  - In the missions API, use `get_request_language(request)` and return the corresponding translation.
- **If** they’re fixed in code, either move them to DB + translations or keep frontend-only translation (see 5 below).

### 3. Backend – FAQ

- **If** FAQ entries (category, question, answer) are in the DB (e.g. in `support`):
  - Add FAQ translation model(s) or language-aware fields.
  - In the FAQ API, use `get_request_language(request)` and return translated category/question/answer.
- Frontend already sends language via apiClient.

### 4. Backend – rewards/shop/donate

- **If** reward item names/descriptions come from the backend:
  - Add translation support (e.g. `RewardTranslation` or language on the reward model) and return translated name/description by request language.
- **If** they’re static in frontend only, no backend change; ensure all UI strings use `t()` (see 5).

### 5. Frontend – audit for missing keys

- **Subscription plans page** (`SubscriptionPlansPage.tsx`): plan names, feature lists, CTAs, status messages – ensure every user-facing string uses `t()` and keys exist in both `en` and `ro`.
- **Onboarding**: questionnaire steps, completion modal – already use `t()` in many places; verify all labels and messages have keys and RO translations.
- **Auth**: login, register, forgot/reset password – verify all labels, placeholders, errors use `t()` and are in both locale files.
- **Dashboard**: headers, CTAs, status summary, daily goal, error states – same check.
- **Missions UI**: labels like “Zilnic”, “Progres”, “Schimbă misiunea”, “De ce contează” – confirm they all come from `t()` and have RO entries (many already in `missions.*`).
- **Modals / toasts**: UpsellModal, cookie consent, any global toasts – use `t()` with keys in common/shared.
- **Footer / legal**: Footer links, CookiePolicy, any legal text – translate or mark as “EN only” and hide in RO if needed.
- **Date formatting**: Any date (e.g. “February 2026”) should use the active locale (e.g. `formatDate(..., locale)` with `locale` from `getLocale()` or `i18n.language`) so RO shows Romanian month names.

### 6. Frontend – remaining raw API calls

- **Optional:** Switch any remaining `axios.get(BACKEND_URL/...)` to `apiClient` where the endpoint will (or already does) return translated content, so the backend receives `X-App-Language` / `Accept-Language`.

### 7. Quality and consistency

- **Spelling:** “Romana” → “Română” in `SUPPORTED_LANGUAGES` if you want the correct diacritic.
- **Review RO copy:** Pass through RO locale files and fix tone, terminology (e.g. “monede” vs “coins”), and placeholders.
- **Missing keys:** Add default values in `t()` where needed and add the key to both EN and RO so nothing falls back to English in production.

### 8. Optional future

- **More languages:** e.g. `es` (already in constants as coming soon): add locale files, backend `SUPPORTED_LANGUAGES`, translation tables/backfill, then enable in the selector.
- **RTL:** If you add a RTL language, add layout/theme handling and test layout in RTL.
- **SEO:** If you need per-language URLs (e.g. `/ro/...`), add routing and possibly `hreflang`/sitemap; otherwise current single-URL + `document.documentElement.lang` is enough for app language.

---

## Quick checklist

- [ ] Backend: `migrate education` and `backfill_translations` run.
- [ ] Backend: Romanian content filled (or updated) in admin for paths/courses/lessons/sections/quizzes/exercises.
- [ ] Backend: Decide and implement translation for missions (if in DB).
- [ ] Backend: Decide and implement translation for FAQ (if in DB).
- [ ] Backend: Decide and implement translation for rewards/shop items (if from API).
- [ ] Frontend: Subscription plans page – all strings via `t()` and in EN/RO.
- [ ] Frontend: Auth, onboarding, dashboard, missions UI – audit and add missing keys/RO.
- [ ] Frontend: Dates use locale everywhere.
- [ ] Frontend: Fix “Romana” → “Română” if desired.
- [ ] Review all RO JSON files for consistency and terminology.

If you tell me which of these you want to do first (e.g. “subscription page strings” or “missions backend”), I can outline or implement the exact code changes next.
