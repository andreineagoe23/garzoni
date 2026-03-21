# Skill intent: analytics funnels and dashboards

Instrumentation lives in the frontend (`useAnalytics` → Amplitude + `recordFunnelEvent` → backend ingest). Use **the same event names** in Amplitude and in SQL over `FunnelEvent` (or your warehouse) so product and engineering agree.

## Event reference (skill / exercises)

| Event | When | Key properties |
|-------|------|----------------|
| `weak_skill_click` | User taps a weak-skill card on the dashboard | `skill` |
| `improve_recommendation_click` | User taps “practice” on a weak-skill recommendation | `skill` |
| `quick_card_exercises_click` | User taps the quick-card CTA for exercises | `skill` |
| `exercises_page_view` | `/exercises` loads (authenticated) | `skill_in_query`, `intent_source`, `intent_reason`, `from_dashboard`, `dashboard_entry_surface` |
| `exercise_skill_intent_received` | Skill intent is known after the layout gate | `skill`, `source`, `reason`, `from_dashboard` |
| `exercise_skill_intent_mapped` | Resolver finished: skill mapped to a category | `skill`, `category`, `result_count`, `mapped_zero_results` |
| `exercise_skill_intent_unmapped` | Resolver could not map skill | `skill`, `result_count` |
| `exercise_skill_intent_mapped_zero` | Mapped category returned **zero** exercises | `skill`, `category` |
| `exercise_skill_intent_manual_category` | User changed category while `?skill=` was present | `previous_skill_param`, `new_category` |
| `exercise_skill_intent_cleared` | Clear filter or dismiss recommendation | `action`: `clear_filter` \| `dismiss_recommendation` |
| `exercise_started` | First valid submit attempt on this page visit | `exercise_id`, `exercise_type`, `category`, `from_dashboard_skill_flow` |
| `exercise_skill_intent_engaged` | First submit while user arrived via dashboard skill flow | `exercise_id` |

`dashboard_entry_surface` on `exercises_page_view`: `quick_card` | `weak_skill_practice` | `weak_skill_card` | `skill_query_only` | `organic`.

## Suggested Amplitude funnels

1. **Dashboard → exercises → started**
   Steps: (`weak_skill_click` OR `improve_recommendation_click` OR `quick_card_exercises_click`) → `exercises_page_view` → `exercise_started`
   Segment by prior step’s `skill` vs `skill_in_query` / `intent_reason` if needed.

2. **Mapped vs unmapped**
   Among sessions with `exercise_skill_intent_received`, compare counts of `exercise_skill_intent_mapped` vs `exercise_skill_intent_unmapped` (or filter `mapped_zero_results` on the mapped event).

3. **Mapped zero rate**
   `exercise_skill_intent_mapped_zero` / `exercise_skill_intent_mapped` (or filter `mapped_zero_results === true`).

4. **Manual override after intent**
   Funnel: `exercise_skill_intent_received` → `exercise_skill_intent_manual_category` (same session/user).

5. **Quick card vs weak-skill card**
   Compare `exercises_page_view` where `dashboard_entry_surface` is `quick_card` vs `weak_skill_card` (and optionally `weak_skill_practice`) on downstream `exercise_started` or `exercise_skill_intent_engaged`.

## Backend allowlist

New event types must appear in `FunnelEventIngestView.ALLOWED_EVENT_TYPES` in `backend/finance/views.py` and in `ANALYTICS_EVENTS` in `frontend/src/types/analytics.ts`.

After adding events on the frontend, **restart the Django process** (or rebuild/redeploy the API). Otherwise `POST /api/funnel/events/` returns **400** with `Unsupported event type` for the new names. Funnel posts use `skipGlobalErrorToast` so this does not spam UI toasts, but failed requests still appear in the network tab until the server is updated.
