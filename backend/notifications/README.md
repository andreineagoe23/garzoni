# Notifications (Customer.io + SMTP)

## Environment variables (backend)

| Variable                          | Purpose                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `CIO_REGION`                      | `us` or `eu` (API + track hosts).                                                                     |
| `CIO_CDP_API_KEY`                 | **CDP** write key (Pipelines “Customer.io API” source; `POST …/v1/identify`, Basic `key:`).           |
| `CIO_CDP_ENABLED`                 | `true` to send CDP identify (default true).                                                           |
| `CIO_SITE_ID`                     | **Classic Track** site id (optional if you only use CDP).                                             |
| `CIO_TRACK_API_KEY`               | **Classic Track** API secret.                                                                         |
| `CIO_APP_API_KEY`                 | App API key (transactional email/push).                                                               |
| `CIO_TRACK_ENABLED`               | `true` to send identify/track.                                                                        |
| `CIO_TRANSACTIONAL_ENABLED`       | `true` to send via transactional API when templates are mapped.                                       |
| `CIO_TRANSACTIONAL_TRIGGERS_JSON` | Map template slug → id or trigger name, e.g. `{"password-reset":12,"welcome":13}`.                    |
| `CIO_JOURNEY_EVENTS_ENABLED`      | `true` to emit journey events from Celery tasks.                                                      |
| `CIO_REMINDERS_VIA_JOURNEYS`      | When `true` with journey events + track enabled, reminder beat jobs **track only** (no direct email). |

Transactional sends require a mapping for each `CioTemplate` slug you enable; otherwise the service falls back to Django SMTP + HTML templates.

## Client-track API (web)

Authenticated `POST /api/notifications/client-track/` with JSON `{ "name": "checkout_abandoned", "properties": { ... } }` for whitelisted journey events. Requires `CIO_TRACK_ENABLED` on the server.

## Person identifier

Customer.io `id` is `str(user.pk)` (same as JWT `user_id` on mobile).

## Test CDP Pipelines connection (CLI)

With `CIO_CDP_API_KEY` and `CIO_REGION=eu` in the environment:

```bash
python manage.py cio_cdp_ping
```

Then click **Retest connection** in Customer.io. Normal profile sync also calls CDP identify when `CIO_CDP_API_KEY` is set.

## Where to put secrets (local / Railway / Vercel / EAS)

**Do not commit** `.env` files. If keys were pasted into chat or tickets, **rotate** them in Customer.io after setup.

### Garzoni backend (Railway or any Django host)

Set **`CIO_CDP_API_KEY`** to the API key shown on the **Pipelines → Customer.io API** source (the same value used in their test curl as the Basic auth username before `:`). Garzoni sends **`POST https://cdp-eu.customer.io/v1/identify`** (or `https://cdp.customer.io` when `CIO_REGION=us`).

Optionally add **classic Track** credentials (`CIO_SITE_ID` + `CIO_TRACK_API_KEY`) from **API Credentials → Tracking** if you also want `PUT https://track-eu.customer.io/api/v1/customers/{id}`; identify runs **both** when configured.

| Variable                          | Railway (backend)                                  |
| --------------------------------- | -------------------------------------------------- |
| `CIO_SITE_ID`                     | Workspace Site ID (Tracking)                       |
| `CIO_TRACK_API_KEY`               | Tracking API secret (Tracking)                     |
| `CIO_APP_API_KEY`                 | App API key (transactional sends)                  |
| `CIO_REGION`                      | `eu` or `us`                                       |
| `CIO_TRACK_ENABLED`               | `True` / `False`                                   |
| `CIO_TRANSACTIONAL_ENABLED`       | `True` when templates are mapped                   |
| `CIO_TRANSACTIONAL_TRIGGERS_JSON` | One-line JSON slug → id or trigger name            |
| `CIO_JOURNEY_EVENTS_ENABLED`      | `True` to emit server journey events               |
| `CIO_REMINDERS_VIA_JOURNEYS`      | `True` only after journeys replace reminder emails |

### Garzoni frontend (Vercel)

Browser tracker uses **only** the public Site ID (same Tracking Site ID as above).

| Variable           | Vercel (frontend)                                 |
| ------------------ | ------------------------------------------------- |
| `VITE_CIO_SITE_ID` | Same as `CIO_SITE_ID` (Tracking site id)          |
| `VITE_CIO_REGION`  | Optional: `eu` if you set `_setDomain` / EU track |

### Garzoni mobile (EAS / Expo env)

Uses the **CDP / React Native SDK** (different from Django Track REST).

| Variable                      | EAS secrets / `mobile/.env`                     |
| ----------------------------- | ----------------------------------------------- |
| `EXPO_PUBLIC_CIO_CDP_API_KEY` | CDP API key from Customer.io mobile / CDP setup |
| `EXPO_PUBLIC_CIO_SITE_ID`     | Optional; enables in-app when set               |
| `EXPO_PUBLIC_CIO_REGION`      | `eu` or `us`                                    |

### Quick mapping from what you described

- **App API key** (transactional, long hex) → **`CIO_APP_API_KEY`** on **Railway** only.
- **Pipelines / CDP test curl** key (often shown alone in Basic as `key:`) → used for **CDP** tools; for **Django** you still need **Site ID + Tracking API key** from **API Credentials → Tracking**. If the UI shows a single CDP write key, use Customer.io docs to find the matching **Tracking** secret for server `identify`/`track`, or contact CIO support—do not guess by reusing the CDP key unless their docs say it works with the Track API.
