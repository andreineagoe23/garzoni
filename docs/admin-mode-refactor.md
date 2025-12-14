# Admin mode refactor recommendations

## Current front-end experience
- Lesson pages now normalize lessons into ordered `lesson.sections` and render tab navigation with completion state, admin-only add/edit/reorder controls, and publish badges for drafts.【F:frontend/src/components/courses/LessonPage.jsx†L544-L743】
- The admin panel on the page uses `LessonSectionEditorPanel`, which offers CKEditor-backed rich text, JSON editing for exercises, publish/draft toggles, deletion, autosave state, preview mode, and the ability to attach existing exercises.【F:frontend/src/components/courses/LessonSectionEditorPanel.jsx†L100-L240】

## Backend data model
- `LessonSection` stores ordered sections with text, video, or exercise content types, JSON exercise payloads, publish flags, and audit metadata (`updated_at`, `updated_by`).【F:backend/education/models.py†L78-L114】
- The legacy `Lesson` model still includes single-section fields (`video_url`, `exercise_type`, `exercise_data`) alongside rich `detailed_content` despite sections being the primary representation now.【F:backend/education/models.py†L44-L77】
- Hearts (lives) already exist on `UserProfile` and have supporting APIs for regeneration, decrement, grant, and refill behavior, so admin integration should build on these rather than re-inventing them.【F:backend/authentication/models.py†L7-L56】【F:backend/authentication/views.py†L238-L388】

## Current Django admin gaps
- The lesson admin uses a `TabularInline` that exposes only order, title, and content type by default; text/video/exercise details are hidden in collapsible fieldsets and omit publish state or metadata updates.【F:backend/education/admin.py†L11-L57】
- There is no inline support for drag-and-drop ordering, publish/draft toggles, or rich JSON editing comparable to the front-end editor.

## Recommended refactors
1. **Align admin UI with section-centric editing**
   - Switch to a `StackedInline` (or sortable inline via `django-admin-sortable2`/`django-nested-admin`) for `LessonSection`, surfacing `is_published`, `exercise_type`, `exercise_data`, `video_url`, `text_content`, and `updated_at/updated_by` together with order controls.
   - Add drag handles and explicit order fields to mirror the on-page reordering UX.
2. **Match rich editing capabilities**
   - Use CKEditor widgets for `text_content` and a JSON/ACE editor for `exercise_data` so admins can edit content with parity to the front-end panel.
   - Provide an autocomplete or FK picker to attach reusable exercises (similar to the front-end attach-existing flow) and show a lightweight preview (HTML render for text, embedded video, or simplified exercise preview).
3. **Publish/workflow parity**
   - Add a prominent publish/draft toggle and status badge in the inline. Include bulk actions on the lesson list to publish/unpublish multiple sections.
   - Ensure admin saves automatically stamp `updated_by` and respect `updated_at` so audit trails stay accurate.
4. **Legacy field deprecation**
   - Hide or mark the legacy `Lesson` content fields as deprecated in admin, guiding editors to create sections instead. Plan a migration path to convert any remaining single-section lessons into `LessonSection` rows and eventually remove the old fields.
5. **Hearts configuration (if exposed to admins)**
   - If admins should manage hearts, add read-only indicators or configurable defaults (e.g., `HEARTS_MAX`) in a dedicated admin view tied to `UserProfile`, reusing the existing heart regeneration and mutation endpoints rather than inventing new fields.
6. **Exercise ergonomics**
   - Prefer structured, inline editing for multiple-choice options (e.g., a `MultipleChoiceChoiceInline`) that auto-updates the JSON payload and correct answers, plus a JSON widget so editors don't handle raw strings.
   - Offer previews that mirror what learners see for multiple-choice and budget-allocation exercises.
7. **Operational workflows**
   - Add admin actions for bulk publishing, version bumping/duplication of exercises, top-up/refill hearts for stuck learners, and converting legacy lesson payloads into modern `LessonSection` records.

## Quick wins
- Add list filters/search in `LessonAdmin` for `course`, publish status (via related sections), and updated dates to help locate lessons needing edits.
- Enable "Save and continue editing" plus autosave-friendly messaging to better support long lessons with many sections, matching the front-end autosave cues.
