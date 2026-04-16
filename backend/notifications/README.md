# Notifications (Customer.io + SMTP)

## Environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `CIO_REGION` | `us` or `eu` (API + track hosts). |
| `CIO_SITE_ID` | Track API site id (identify/track). |
| `CIO_TRACK_API_KEY` | Track API secret. |
| `CIO_APP_API_KEY` | App API key (transactional email/push). |
| `CIO_TRACK_ENABLED` | `true` to send identify/track. |
| `CIO_TRANSACTIONAL_ENABLED` | `true` to send via transactional API when templates are mapped. |
| `CIO_TRANSACTIONAL_TRIGGERS_JSON` | Map template slug → id or trigger name, e.g. `{"password-reset":12,"welcome":13}`. |
| `CIO_JOURNEY_EVENTS_ENABLED` | `true` to emit journey events from Celery tasks. |
| `CIO_REMINDERS_VIA_JOURNEYS` | When `true` with journey events + track enabled, reminder beat jobs **track only** (no direct email). |

Transactional sends require a mapping for each `CioTemplate` slug you enable; otherwise the service falls back to Django SMTP + HTML templates.

## Person identifier

Customer.io `id` is `str(user.pk)` (same as JWT `user_id` on mobile).
