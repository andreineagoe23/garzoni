# Customer.io overhaul — status

> **SUPERSEDED 2026-08-18** by `docs/notifications/audit-2026-07-22.md`. Note that
> `CIO_TRACK_ENABLED` and `CIO_JOURNEY_EVENTS_ENABLED` both default to **False** today
> (`backend/settings/settings.py:597,603`) — only CDP identify and transactional default on.

Last updated: 2026-05-29
Workspace: `garzoni` (env `215084`)

## Why this happened

People were getting the "A quick check-in from garzoni" email every day. Root cause: campaign 3 "Monthly Reminder" had `restart_mode=rematch`, `restart_min_interval=0`, `frequency_cap_mode=no_cap`. Backend cron was firing `monthly_reminder_eligible` daily and CIO had no resend guard. Some users also kept getting mail after unsubscribing — duplicate profiles (same email, different `id`) with split unsubscribe state.

## Strategy now in place

- **Push handles daily.** Streak push (TM 21), Day-3 onboarding push, 3-day re-engage push, weekly coach push.
- **Email reserved for** weekly recap (gated on lesson activity), lifecycle moments, billing, win-back.
- **No daily marketing emails anywhere.**
- **Re-engagement ladder**: 3d push only → 7d push + email → 14d email only → 30d win-back email.
- **Subscription topics** let users granular-unsub (re-engagement, weekly digest, learning nudges, product updates). Topic 5 "Account & Billing" bypasses caps.

Inspired by Duolingo (push-first, emotional escalation only at 14d+) and Khan Academy (weekly digest only when there's something to celebrate).

## Campaign state

| ID  | Name                   | State        | Channel      | Trigger                                      | Cooldown |
| --- | ---------------------- | ------------ | ------------ | -------------------------------------------- | -------- |
| 1   | Welcome                | running      | email + push | event `user_registered`                      | —        |
| 3   | Monthly Reminder       | **archived** | —            | —                                            | —        |
| 4   | Trial Ending           | running      | email        | event `trial_ending_soon`                    | 1d       |
| 5   | Renewal Upcoming       | running      | email        | event `renewal_upcoming`                     | 7d       |
| 6   | Subscription Cancelled | running      | email        | event `subscription_cancelled`               | —        |
| 7   | Payment Failed         | running      | email + push | event `payment_failed`                       | —        |
| 8   | Checkout Abandoned     | running      | email        | event `checkout_abandoned`                   | 3d       |
| 9   | Re-engage 3d           | running      | push only    | segment 15                                   | —        |
| 10  | Re-engage 7d           | running      | push + email | segment 16                                   | —        |
| 11  | Re-engage 14d          | running      | email only   | segment 17                                   | —        |
| 12  | Win-back 30d           | running      | push + email | segment 18                                   | —        |
| 13  | Streak Alert           | stopped      | —            | (TM 21 push handles streaks)                 | —        |
| 14  | Coach Nudge            | running      | push + email | event `coach_nudge`                          | 7d       |
| 15  | Weekly Digest          | running      | email        | event `weekly_digest_eligible` + attr filter | 6d       |

## Subscription topics

| ID  | Name              | Wired to                                      |
| --- | ----------------- | --------------------------------------------- |
| 1   | Re-engagement     | camps 9, 10, 11, 12                           |
| 2   | Weekly Digest     | camp 15                                       |
| 3   | Learning Nudges   | camp 14                                       |
| 4   | Product Updates   | (future newsletters)                          |
| 5   | Account & Billing | camps 4, 5, 6, 7, 8 — bypasses frequency caps |

## What's done

### Customer.io

- Camp 3 archived.
- Cooldowns set on all event-triggered campaigns.
- Re-engagement camps wired to segment 5 "Unsubscribed" in global exit conditions; `exit_on_trigger_or_filter_not_matched=true`.
- 5 subscription topics created and wired.
- Camps 1, 6, 7 restarted with multi-step sequences.
- Camp 9 stripped to push-only at 3d. Camp 11 stripped to email-only at 14d.
- Camp 14 push parity confirmed (segment-19 mobile gate).
- Camp 15 trigger filter: `weekly_digest_should_send == true`.
- 8 message drafts written and activated (1 intentionally kept draft — winback).
- Workspace-level message cap set to 1 message / 24h with `use_message_limits=true` on all marketing campaigns.

### Backend (this repo)

- `notifications/profile_sync.py` — added `onboarding_completed` and `lessons_completed` traits.
- `authentication/tasks.py` — deleted monthly reminder loop; weekly digest now gated on lesson activity and sets `weekly_digest_should_send` on the profile.
- `onboarding/views.py` — fires CIO identify on questionnaire completion so `onboarding_completed=true` lands before the Welcome day-3 branch evaluates.
- `gamification/signals.py` — fires CIO identify on first `LessonCompletion` per user so `lessons_completed >= 1` is live for the Welcome day-7 branch.

## What's left

### Manual UI (Customer.io)

1. **Workspace Settings → Frequency Capping**
   - Email cap: 1 per 24h
   - Push cap: 1 per 24h
   - Add Topic 5 "Account & Billing" as bypass
   - Overflow: Queue and retry (24h)

2. **Workspace Settings → People → Identity**
   - Enable "Auto-merge profiles with the same email"
   - Confirm one-time backfill so existing duplicates collapse
   - This fixes the "I unsubscribed but still get emails" complaints

### Decisions / content to write

3. **Exit-survey URL** — currently a placeholder in camp 6 action 14.
   - Pick a tool (Google Forms / Typeform / own page)
   - Send the URL to the CIO chatbot to patch

4. **Win-back discount** — camp 6 action 72 is intentionally DRAFT.
   - Decide on the discount (current shell says 30%)
   - When ready, tell the chatbot: "activate winback"

5. **Changelog URL** — camp 6 action 68 links to `https://garzoni.app/changelog`. Confirm the page exists or pick a real destination.

### Backend deploy

6. **Deploy the code changes in this PR** so the new `onboarding_completed` / `lessons_completed` / `weekly_digest_should_send` traits start flowing to CIO. Without the deploy, Welcome journey branches will misroute new users.

## Nothing urgent the chatbot can do right now

Everything outstanding is either (a) a UI-only toggle the CIO API does not expose, (b) needs a content decision from you (discount, exit-survey URL, changelog URL), or (c) needs the backend deploy. The acute spam — "A quick check-in from garzoni" — is already stopped by archiving camp 3 + removing the cron event from `authentication/tasks.py`.

If you want to be belt-and-braces while you wait to do the UI items, the chatbot can also:

- Run a final audit and email you the recipient counts for camps 4, 5, 7, 8 for the last 7 days, so you can sanity-check no new spam pattern emerges.
- Add `subscription_topic_id=5` to TM 21 (streak push) so it's also explicitly billable as transactional. Low priority, but tidy.

Neither is critical.

## How to verify after the backend deploy

In CIO, search your own profile under People → look at the Attributes tab. You should see:

- `onboarding_completed: true` (after you finish the questionnaire)
- `lessons_completed: <integer>` (after you complete at least one lesson)
- `weekly_digest_should_send: true|false` (after Sunday noon cron runs)

If those don't appear, the deploy didn't land or the backend identify call failed silently — check Celery worker logs for `"CIO sync after onboarding failed"` or `"weekly_digest_should_send sync failed"`.
