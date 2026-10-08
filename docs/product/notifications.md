# Notifications

> Garzoni reaches learners through **mobile push**, **email** and **in-app toasts**. Push comes from
> three places: the Django backend sending through Expo, Customer.io journeys sending through the
> Customer.io mobile SDK, and reminders the phone schedules for itself. Email is sent through
> Customer.io (transactional messages and journeys), or through Django SMTP / Resend as a fallback.
> Most lifecycle messaging (welcome, re-engagement, streak-at-risk, digests, billing) is built as
> **Customer.io journeys** started by events the backend sends. The code switches for those events
> (`CIO_TRACK_ENABLED`, `CIO_JOURNEY_EVENTS_ENABLED`) are **off by default**, and production turns them
> on through Railway variables. The web app sends no push. AI push nudges have been switched off
> since 2026-05-30 (see [ai.md](ai.md#ai-push-nudges-switched-off)).

_Last reviewed: 2026-10-08, against `master` at `d431e781`. Production flag values and Customer.io
automation states are taken from `.claude/context/feature-status.md` and were not re-checked._

## Channels

| Channel                            | Web                  | Mobile                          | How it is sent                                                                                                 | Status                                                                                                                  |
| ---------------------------------- | -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Push from the backend (Expo)       | —                    | ✅                              | `notifications/expo_push.py` → Expo push API, to `UserProfile.expo_push_token`                                 | Shipped, with delivery receipts and removal of dead tokens                                                              |
| Push from Customer.io journeys     | —                    | ✅                              | Customer.io's own device list, filled by the Customer.io React Native SDK                                      | Wired in the 1.2.0 store build (`df455231`); needs `EXPO_PUBLIC_CIO_CDP_API_KEY` in the build, otherwise the SDK is off |
| Customer.io transactional push     | —                    | ✅                              | Customer.io App API; used only when the Expo send fails or there is no Expo token                              | Shipped                                                                                                                 |
| Phone-scheduled streak reminder    | —                    | ✅                              | `mobile/src/streak/streakReminder.ts`                                                                          | Shipped                                                                                                                 |
| Web push                           | ❌                   | —                               | —                                                                                                              | Not built. `frontend/src/serviceWorkerRegistration.ts` exists but does not subscribe to push                            |
| Transactional email                | ✅                   | ✅                              | Customer.io transactional messages when a template id is mapped, else Django SMTP or Resend (`EMAIL_PROVIDER`) | Shipped                                                                                                                 |
| Journey email                      | ✅                   | ✅                              | Customer.io journeys started by backend events                                                                 | Depends on production flags, see below                                                                                  |
| In-app toasts                      | ✅ `react-hot-toast` | ✅ `react-native-toast-message` | Client only                                                                                                    | Shipped                                                                                                                 |
| In-app inbox / notification centre | ❌                   | ❌                              | —                                                                                                              | Not built                                                                                                               |
| Customer.io in-app messages        | —                    | ⚠️                              | Customer.io SDK, only when `EXPO_PUBLIC_CIO_SITE_ID` is set                                                    | Unverified                                                                                                              |

## What gets sent and when

### From scheduled jobs

Times are server time (Europe/London) unless noted.

| Message                         | Channel                                                                                      | When                                                                                                  | Who                                                                                     | Gate                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Streak about to expire          | Customer.io event `streak_about_to_expire` → journey (push first)                            | Hourly; sent to each user when it is **7pm in their own timezone** (`education/tasks.py:102,119-189`) | Streak > 0, last activity was their yesterday, nothing today. Once per local day        | `CIO_JOURNEY_EVENTS_ENABLED`                                                                                                       |
| Streak ended                    | Email (`streak-broken`) + Expo push                                                          | 00:00 streak reset (`education/tasks.py:225-247`)                                                     | Streak was more than 3 days and ended in the last 3 days                                | Email: `streak_alerts`. Push: master push switch only                                                                              |
| Weekly digest                   | Email, or Customer.io event `weekly_digest_eligible` when `CIO_REMINDERS_VIA_JOURNEYS` is on | 12:00 daily job, at most once every 6 days per user (`authentication/tasks.py:48-165`)                | `reminder_frequency=weekly`, `weekly_digest` on, at least one lesson in the last 7 days | `reminders` + `weekly_digest`                                                                                                      |
| "A quick check-in from Garzoni" | Email (`reminder-monthly`)                                                                   | Same 12:00 job, at most once every 28 days (`authentication/tasks.py:167-205`)                        | `reminder_frequency=monthly`                                                            | `marketing` **and** `reminders` must be on. `marketing` defaults to off, so few users qualify                                      |
| Coach nudge                     | Customer.io event `coach_nudge`                                                              | Daily 03:20, inside `decay_course_mastery` (`education/tasks.py:44-117`)                              | Users whose mastery decayed; once a day; skips users with no email                      | `CIO_JOURNEY_EVENTS_ENABLED`                                                                                                       |
| Trial ending                    | Email or event `trial_ending_soon`                                                           | 10:00 daily                                                                                           | Trial ends in 2 days                                                                    | `billing_alerts`                                                                                                                   |
| Renewal reminder                | Email or event `renewal_upcoming`                                                            | 10:00 daily                                                                                           | Stripe subscription renews in 3 days                                                    | `billing_alerts`                                                                                                                   |
| Portfolio move                  | Expo push (`portfolio-update`)                                                               | 17:00 daily (`finance/tasks.py:65-160`)                                                               | Paper-trade users with a push token whose top holding moved 2% or more                  | Master push switch                                                                                                                 |
| Personal CFO weekly report      | Customer.io event `personal_cfo_weekly_report` only (`budgeting/tasks.py:169-222`)           | Monday 09:00                                                                                          | Plus/Pro users with any budgeting data                                                  | `CIO_TRACK_ENABLED`. **No email is sent by the backend**; it reaches users only if a Customer.io automation listens for this event |
| League result                   | Event `league_week_closed`                                                                   | Sunday 23:55, after the week closes                                                                   | Every settled league member                                                             | `CIO_JOURNEY_EVENTS_ENABLED`. The Customer.io automation (20) is an empty shell                                                    |
| AI nudge                        | —                                                                                            | —                                                                                                     | —                                                                                       | **Off.** See [ai.md](ai.md#ai-push-nudges-switched-off)                                                                            |

### From things the user does

| Trigger                                                                    | What is sent                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up                                                                    | Welcome email (always sent, ignores preferences) and event `user_registered`, which starts the Welcome journey and the Day 1 / Day 2 activation draft (automation 19, not live) |
| Lesson completed                                                           | Event `lesson_completed`, sent from the server so web counts too (`gamification/signals.py:95-115`). It is the conversion goal for the re-engagement journeys                   |
| Streak reaches 3 / 7 / 14 / 30 days                                        | Event `streak_milestone` (`gamification/services/rewards.py:113-139`). The Customer.io automation (21) is an empty shell                                                        |
| Password reset, password changed                                           | Email, always sent                                                                                                                                                              |
| Stripe checkout paid, invoice paid, payment failed, subscription cancelled | Email + event (`finance/views.py:2147-2410`). Payment failure ignores preferences                                                                                               |
| Web checkout abandoned                                                     | Event `checkout_abandoned`, posted by the web app to `POST /api/notifications/client-track/`, the only event that endpoint accepts                                              |
| Referral reward earned                                                     | Emails to both people with their 50% code (`authentication/tasks.py:317`)                                                                                                       |
| App opened (once per device day)                                           | Event `app_opened`, from the mobile SDK and, since 2026-08-20, from web (`packages/core/src/engagement/appOpenedDaily.ts`)                                                      |
| First lesson finished (mobile)                                             | Arms the push-permission prompt (`markPushPromptDue`)                                                                                                                           |

### Customer.io journeys

According to `.claude/context/feature-status.md` (2026-08-20) and `docs/customer-io-overhaul.md`,
workspace 215084 has 14 running automations: Welcome, Trial Ending, Renewal Upcoming, Subscription
Cancelled, Payment Failed, Checkout Abandoned, Re-engage 3d / 7d / 14d, Win-back 30d, Coach Nudge,
Weekly Digest and others. Re-engagement uses saved segments based on inactivity and repeats every
14/30/60/90 days. The account-wide frequency caps are set in Customer.io: email 1 a day and 3 a week,
push 2 a day and 5 a week. Push-or-email branches check Customer.io segment 8, "Have a Mobile
Device". The journey content and settings live only in Customer.io, not in this repo.

### Phone-scheduled reminders (mobile)

- When the streak is at least 1, the app schedules a reminder at **8pm device time on each of the
  next 7 days**, and reschedules every time the app opens. The wording gets stronger over the days,
  then switches from "save your streak" to "start a new one" (`mobile/src/streak/streakReminder.ts`).
- These are sent even if the backend or Customer.io is down, and they do not count against any cap.

### Android channels

Five channels: `streak`, `lessons`, `billing`, `marketing`, `default`
(`mobile/src/bootstrap/pushNotificationsMobile.ts:41-90`). The backend picks one from the push
category (`notifications/policy.py:179-191`). Calls that pass no category, such as "streak ended",
land on `default`.

## User controls

| Control                                                       | Where                                                                                               | What it does                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push master switch (`push_notifications`)                     | Settings, web and mobile                                                                            | Blocks all backend push. Also sets the Customer.io `has_mobile_app` trait to false                                                                                                                                                                              |
| Streak alerts (`streak_alerts`)                               | Settings                                                                                            | Blocks the streak-ended email and pushes in the `streak` category                                                                                                                                                                                               |
| Reminders (`reminders`) + frequency (weekly / monthly / none) | Settings                                                                                            | Weekly digest and monthly check-in emails                                                                                                                                                                                                                       |
| Weekly digest (`weekly_digest`)                               | Settings                                                                                            | Weekly digest email                                                                                                                                                                                                                                             |
| Billing alerts (`billing_alerts`)                             | Settings                                                                                            | Trial-ending, renewal and cancellation emails. Receipts and payment failures are always sent                                                                                                                                                                    |
| Tips and announcements (`marketing`, off by default)          | Settings                                                                                            | Marketing email and pushes in the `marketing` category. Turning it back on also re-subscribes the person in Customer.io (`resubscribe_customer_in_cio`)                                                                                                         |
| One-click unsubscribe link                                    | Reminder emails, `GET /api/email/unsubscribe/?token=…` (`authentication/views_password.py:262-300`) | Turns off `reminders` and `weekly_digest` and sets frequency to `none`. Signed token, valid 1 year                                                                                                                                                              |
| Customer.io unsubscribe / bounce / spam                       | Customer.io reporting webhook → `POST /api/notifications/cio-webhook/`                              | Unsubscribe, bounce or spam turns off `marketing`, `reminders`, `weekly_digest`; re-subscribe turns `marketing` back on                                                                                                                                         |
| OS permission                                                 | Phone settings                                                                                      | Asked once, after a priming screen. Since the 2026-07 audit, onboarding no longer asks; the prompt appears after the first finished lesson (`app/index.tsx` + `pushPromptState.ts`). If the OS has blocked push, the Settings switch opens the phone's settings |
| Android channels                                              | Phone settings                                                                                      | Mute one topic, such as `marketing`, without muting `billing`                                                                                                                                                                                                   |

Settings are stored in `UserEmailPreference` (`backend/authentication/models.py:335-360`) and read and
written through `GET/PATCH /api/user/settings/`.

## Under the hood

**Rules for each send** (`backend/notifications/policy.py`):

- `should_send_email`: password, verification, magic link, order, receipt and payment-failed emails
  always go out (if there is an email address). Welcome and referral emails always go out. Trial,
  renewal and cancellation emails follow `billing_alerts`. Everything else follows the matching
  topic, and any new marketing template follows `marketing`.
- `should_send_push`: master switch first, then `streak_alerts` for the `streak` category and
  `marketing` for the `marketing` category. Other categories use the master switch only. This is
  deliberately narrow: bounces turn off email preferences, and those must not silently turn off
  push as well.
- `resolve_channels`: push first when the user has an Expo token, email otherwise.
- `NOTIFICATION_DAILY_CAP` (default **2**, `settings/settings.py:676-684`) limits non-essential
  messages per user per day, counted in the cache.

**Sending push** (`backend/notifications/transactional.py:71-125`): Expo first if a token exists,
because the Customer.io App API returns success even when it has no device to send to. If Expo
fails or there is no token, it falls back to a Customer.io transactional push.

**Delivery checks** (`backend/notifications/tasks.py:384-500`): every Expo send stores a
`PushTicket`. `poll_expo_push_receipts` runs every 20 min and reads Expo's receipts, the only place
a revoked Apple key or a dead device shows up. `DeviceNotRegistered` clears the token and updates
Customer.io. Tickets are kept 7 days.

**Customer.io profile** (`backend/notifications/profile_sync.py`, `customer_io.py`): identify goes
through the CDP API (`CIO_CDP_ENABLED`, on by default). Email and traits go through the Track API
profile update (`CIO_TRACK_PROFILE_UPSERT`, on). Events go through the Track API only when
`CIO_TRACK_ENABLED` is on. The person id is the Django user id.

**Template ids**: `CIO_TRANSACTIONAL_TRIGGERS_JSON` maps 18 template names to Customer.io message ids
(`settings/settings.py:686-695`). A template with no id falls back to the Django HTML template over
SMTP or Resend.

### Scheduled jobs

Production runs Celery Beat with `django_celery_beat`'s `DatabaseScheduler`
(`backend/docker/entrypoint.sh:129`), so the live schedule is the `PeriodicTask` rows in the database.
Two sources write those rows:

1. Migrations (`authentication/0020`, `0023`, `0025`, `0028`, `education/0040`, `gamification/0016`,
   `0018`). `decay-course-mastery-daily` (03:20) exists **only** here.
2. The static `beat_schedule` in `backend/settings/celery.py:36-165`. When Beat starts, the
   scheduler writes every entry in that list into the database by name
   (`django_celery_beat/schedulers.py:240-242`, `setup_schedule` → `update_from_dict`). So the static
   list is not only a fallback: on every Beat restart it overwrites database rows with the same name.
   For example, migration `0028` seeded `emit-streak-about-to-expire` at 19:00 daily, and the static
   list changes it back to hourly on restart. Rows the static list does not mention, such as the
   disabled `send-ai-nudges-daily`, are left alone.

Notification jobs: streak sweep hourly; streak reset 00:00; weekly digest / monthly check-in 12:00;
trial and renewal 10:00; portfolio push 17:00; CFO report Monday 09:00; push receipts every 20 min;
ticket prune 04:30.

### Analytics (brief)

- **Amplitude**: one event list shared by both apps (`packages/core/src/services/analyticsCore.ts`).
  Web uses `@amplitude/analytics-browser`, mobile uses `@amplitude/analytics-react-native` and does
  nothing without `EXPO_PUBLIC_AMPLITUDE_API_KEY`.
- **GA4 / gtag**: web only, loaded in `frontend/index.html` with consent defaults and ad-data
  redaction. Several web tools pages fire gtag events.
- **Customer.io events**: the backend events listed above, `app_opened` from web and mobile, and
  `checkout_abandoned` from web.
- **Funnel events**: stored in Django (`finance.FunnelEvent`, `record_funnel_event_task`) for the
  staff-only pricing dashboard.

## Known gaps and flags

- **The journey flags are off in code and on in production.** `CIO_TRACK_ENABLED`,
  `CIO_JOURNEY_EVENTS_ENABLED` and `CIO_REMINDERS_VIA_JOURNEYS` all default to `False`
  (`settings/settings.py:668-675`). A fresh environment without the Railway variables sends no
  journey events at all: no streak-at-risk, coach nudge, lesson-completed, milestone or league
  events.
- **The daily cap protects almost nothing.** `within_frequency_cap` is called only from
  `send_marketing_nudge` (`notifications/service.py:429`), and only the switched-off AI nudge uses
  that. Streak-ended, portfolio and digest messages are not counted. In practice the caps that apply
  are the ones set in Customer.io.
- **"Streak ended" push ignores the streak-alerts switch.** It checks the `transactional` category,
  which only follows the master switch, and it lands on the Android `default` channel
  (`education/tasks.py:235-247`).
- **The CFO "weekly report email" is only an event.** The backend sends `personal_cfo_weekly_report`
  to Customer.io and nothing else. Whether anyone gets an email depends on a Customer.io automation
  that is not recorded in this repo.
- **The monthly check-in email still exists.** The function's description says "the monthly leg is
  gone", but the code below it still sends `reminder-monthly` every 28 days to users with monthly
  frequency who have opted into marketing (`authentication/tasks.py:167-205`).
- **Celebration journeys are empty.** Streak milestone (automation 21) and league result
  (automation 20) have no trigger and no actions; Day 1 / Day 2 activation (19) is a draft.
- **`send_email_verification` and `send_magic_login` have no callers** outside
  `notifications/service.py`.
- **Customer.io push needs a build with the right key.** Without `EXPO_PUBLIC_CIO_CDP_API_KEY` the
  SDK turns itself off and journey push has no device to send to.
- **12 of 13 journeys still drop unsubscribed people before the push branch**
  (`send_to_unsubscribed: false`), so an email unsubscribe also stops journey push. The fix is
  separate email and push subscription topics in Customer.io (`docs/notifications/audit-2026-07-22.md`
  §3.9).
- **Some send times follow London, not the learner.** The streak sweep and streak reset use each
  user's own timezone, but coach nudges are sent at 03:20 London time and the digest, billing and
  portfolio jobs run on London hours. Any later delay is up to the Customer.io journey.
- **No soft re-ask after a push decline.** A learner who says no to the OS prompt is never asked
  again unless they find the Settings switch (audit §4).
