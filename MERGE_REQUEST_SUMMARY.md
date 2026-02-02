# Merge request summary

## Tests and quality

- **Backend**: 19 tests passing (`tests.test_api`, `onboarding.tests`) — run via `docker compose exec backend python manage.py test tests.test_api onboarding.tests`
- **Frontend**: 35 tests passing — run via `npm test -- --watchAll=false`
- **Lint**: `npm run lint` passes (warnings only, no errors)

## Changes in this branch

### New / updated tests

1. **SubscriptionPlansPage (frontend)**
   - Renders plan details from `/plans`
   - Navigates to onboarding when questionnaire incomplete and user clicks Plus
   - Navigates to all-topics when questionnaire complete and user clicks Starter (Free)
   - Calls subscription create and redirects to Stripe when questionnaire complete and user clicks Plus
   - Axios mock updated so `httpClient` (used by `questionnaireService`) gets an axios-like object with `interceptors` and `create()`, fixing the "Cannot read properties of undefined (reading 'interceptors')" error in tests.

2. **Dashboard (frontend)**
   - Personalized path CTA: button selector updated from `/personalizedPath/i` to `/personalized path/i` to match the visible label "Personalized Path" (and "Complete Onboarding" when incomplete).

3. **Backend subscription workflow** (already present)
   - `SubscriptionCreateTest`: rejects Starter, rejects free plan_id, 503 when Stripe not configured, Plus returns redirect URL with `mode=subscription`.
   - `PlansCatalogTest`: plans include personalized_path feature by tier.

### Bugfixes for test / CI

4. **Education migration 0010 (SQLite test DB)**
   - `connection.vendor` for SQLite is `"sqlite"`, not `"sqlite3"`. Migration now uses `vendor == "sqlite"` so the SQLite branch runs and only adds `version` when missing.
   - Added `try/except OperationalError` and ignore "duplicate column name" so the migration is safe when the column already exists (e.g. from 0003).

5. **Onboarding test_progress_percentage**
   - Progress percentage is **question-based** (answered / total questions), not section-based. Test fixture has 3 questions; at `current_section_index=1` we have 2 answered → 66%. Expected value updated from 50 to 66.

## Feature context (from earlier work)

- Subscription flow: Starter (free) → all-topics; Plus/Pro → Stripe checkout; onboarding completion checked via questionnaire-progress API on SubscriptionPlansPage.
- Dashboard: personalized path CTA routes to onboarding when incomplete, to personalized-path when complete (and paid).
- Backend: subscription create rejects Starter/free, returns 503 when Stripe not configured, uses `mode=subscription` for recurring prices.

## How to run before merge

```bash
# Backend (with Docker)
docker compose exec backend python manage.py test tests.test_api onboarding.tests

# Frontend
cd frontend && CI=true npm test -- --watchAll=false
cd frontend && npm run lint
```
