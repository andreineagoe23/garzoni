# Customer.io Journeys Setup — Push-First Re-engagement

This document describes the segments and Journey campaigns to create in Customer.io workspace `215084` (EU region) to drive the re-engagement / streak / digest sends. Backend pieces (channel router, trait sync, event emission) are already wired — Customer.io just needs the matching automations.

The MCP OAuth token used during development is read-only, so segments and campaigns must be created in the UI or via a service-account token with write scope. The JSON shapes below are paste-ready for any tool that posts to the Fly API.

## Traits & Events Backend Emits

| Trait / Event                                                                                         | Source                                                           | Use                             |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| `has_mobile_app` (bool)                                                                               | `profile_sync.py` — derived from `UserProfile.expo_push_token`   | Branch condition: push vs email |
| `last_active_at` (unix ts)                                                                            | `profile_sync.py` — `max(last_login_date, last_completed_date)`  | Inactivity segment membership   |
| `streak` (int)                                                                                        | `profile_sync.py`                                                | Streak-alert journey filter     |
| `marketing_opt_in`, `reminders_opt_in`, `weekly_digest_opt_in`, `streak_alerts_opt_in`, `push_opt_in` | `profile_sync.py`                                                | Per-channel suppression filters |
| `user_registered` (event)                                                                             | `notifications/service.py` welcome path                          | Welcome journey trigger         |
| `coach_nudge` (event)                                                                                 | `education/tasks.py` `decay_course_mastery`                      | Coach-nudge journey trigger     |
| `streak_about_to_expire` (event)                                                                      | `education/tasks.py` `emit_streak_about_to_expire` (daily 19:00) | Streak-alert journey trigger    |

## 1. Segments

Create five dynamic segments. Each uses an `attribute_change` event on a trait the backend now syncs.

### 1a. Garzoni: Inactive 3+ days

```json
{
  "segment": {
    "name": "Garzoni: Inactive 3+ days",
    "description": "last_active_at older than 3 days. Drives the re-engage 3d journey.",
    "conditions": {
      "and": [
        {
          "or": [
            {
              "event": {
                "type": "attribute_change",
                "name": "last_active_at",
                "filters": {
                  "and": [
                    {
                      "field": "to",
                      "operator": "timestamp_lt",
                      "value": "-259200",
                      "inverse": false
                    },
                    {
                      "field": "from",
                      "operator": "timestamp_lt",
                      "value": "-259200",
                      "inverse": true
                    }
                  ]
                }
              },
              "times": 1,
              "within": 0,
              "inverse": false
            }
          ]
        }
      ]
    }
  }
}
```

### 1b. Garzoni: Inactive 7+ days

Same shape, `value: "-604800"` (both `to` and `from` filters).

### 1c. Garzoni: Inactive 14+ days

Same shape, `value: "-1209600"`.

### 1d. Garzoni: Inactive 30+ days

Same shape, `value: "-2592000"`.

### 1e. Garzoni: Has Mobile App

```json
{
  "segment": {
    "name": "Garzoni: Has Mobile App",
    "description": "has_mobile_app == true (Expo push token present on backend).",
    "conditions": {
      "and": [
        {
          "or": [
            {
              "event": {
                "type": "attribute_change",
                "name": "has_mobile_app",
                "filters": {
                  "and": [
                    {
                      "field": "to",
                      "operator": "eq",
                      "value": "true",
                      "inverse": false
                    },
                    {
                      "field": "from",
                      "operator": "eq",
                      "value": "true",
                      "inverse": true
                    }
                  ]
                }
              },
              "times": 1,
              "within": 0,
              "inverse": false
            }
          ]
        }
      ]
    }
  }
}
```

## 2. Journey campaigns

All campaigns use the same workflow shape: a single `conditional_branch_action` keyed on `has_mobile_app == true` whose two branches deliver the same content over different channels.

```
ENTRY → conditional_branch(has_mobile_app == true)
        ├─ branch 0: push_action → exit
        └─ branch 1 (default): email_action → exit
```

For each Journey, set:

- **Exit conditions**: include `[{ "segment": { "id": <next-tier-segment-id> } }]` (skip-if-already-in-next-segment) so a person doesn't get re-engaged multiple times in one tier.
- **`send_to_unsubscribed`**: false
- **`use_message_limits`**: true

### 2a. Re-engage 3d (behavioral, anchor = "Garzoni: Inactive 3+ days")

Push copy:

- Title: `Still on the path?`
- Body: `Your next 5-minute lesson is ready. Tap to keep your streak alive.`
- `data.deeplink`: `garzoni:///(tabs)/learn`

Email copy: Subject `Pick up where you left off`; body links back to learn tab.

Exit-when-in: Inactive 7+ days segment (so the 7d journey takes over).

### 2b. Re-engage 7d (behavioral, anchor = "Garzoni: Inactive 7+ days")

Stronger CTA. Same push/email shape. Exit-when-in: Inactive 14+ days.

### 2c. Re-engage 14d (behavioral, anchor = "Garzoni: Inactive 14+ days")

"We miss you" tone + a lesson highlight. Exit-when-in: Inactive 30+ days.

### 2d. Win-back 30d (behavioral, anchor = "Garzoni: Inactive 30+ days")

Discount or streak-rescue offer. Filter to `subscription_status != active` (paid users get a different message — wire later if needed).

### 2e. Streak Alert (event-triggered)

Trigger: event `streak_about_to_expire`. Filter: `streak > 0`. Push-priority (so even the branch's fallback email is acceptable — preserve the branching pattern).

Push:

- Title: `Your {{event.streak_count}}-day streak is at risk`
- Body: `Open a 1-minute lesson before midnight to keep it.`
- `data.deeplink`: `garzoni:///(tabs)/learn`

### 2f. Coach Nudge (event-triggered)

Trigger: event `coach_nudge`. Body uses `{{event.course_title}}`, `{{event.proficiency}}`, `{{event.idle_days}}`.

### 2g. Weekly Digest (date / cron — every Sunday 09:00)

Filter: `last_active_at > -604800` (active in past 7 days). Email-only (do NOT branch on `has_mobile_app`) — digest content needs the email surface.

## 3. Welcome Journey (event-triggered)

Trigger: event `user_registered`. No branching — welcome is always email (matches current behavior in `notifications/service.py:send_welcome`).

## 4. Action filters reference

`conditional_branch_action` branch condition (base64-encoded JSON, double-encoded per `fly-api/campaigns.md`):

Filter JSON (before encoding):

```json
[
  {
    "field": "has_mobile_app",
    "operator": "eq",
    "type": "attribute",
    "value": "true"
  }
]
```

Encode: URL-encode, then base64. The Customer.io UI does this automatically when you choose "Customer attribute equals true" in the branch editor.

## 5. Verifying delivery end-to-end

1. Identify a test user in CIO and confirm `has_mobile_app`, `last_active_at`, and `streak` traits arrive (Person view → Attributes).
2. Backdate `last_active_at` for the test user to 4 days ago by republishing identify with the older timestamp (or use the Customer.io API directly).
3. Wait for the segment rebuild; confirm test user enters "Garzoni: Inactive 3+ days".
4. Confirm the Re-engage 3d Journey fires the push branch (preview in CIO UI before launching live).
5. Toggle `has_mobile_app` to `false` (clear `expo_push_token` on backend via the Settings → Push toggle); confirm the next inactivity tier fires the email branch.
