# Accounts, onboarding and support

> One Garzoni account works on the web and both mobile apps. People sign up with email and
> password, Google, or (on iOS) Apple; answer a short onboarding questionnaire that shapes their
> learning plan; and manage their profile, preferences, language and subscription from settings.
> Support and feedback are built into the app, and staff manage content and users through the
> Django admin.

_Last reviewed: 2026-10-08._

## At a glance

| Feature                                                           | Web | Mobile | Notes                                               |
| ----------------------------------------------------------------- | --- | ------ | --------------------------------------------------- |
| Email and password sign-up and login                              | ✅  | ✅     | reCAPTCHA protects web forms                        |
| Google sign-in                                                    | ✅  | ✅     |                                                     |
| Sign in with Apple                                                | —   | ✅ iOS |                                                     |
| Password reset by email                                           | ✅  | ✅     |                                                     |
| Onboarding questionnaire and plan summary                         | ✅  | ✅     | Versioned questionnaire                             |
| Profile (avatar, XP, streak, badges, goals, activity)             | ✅  | ✅     |                                                     |
| Settings (details, email reminders, sounds, animations, password) | ✅  | ✅     |                                                     |
| Language: English or Romanian                                     | ✅  | ✅     | Header switch; Romanian also follows the `/ro` site |
| Account deletion                                                  | ✅  | ✅     | From settings                                       |
| Cookie consent                                                    | ✅  | n/a    | Banner controls GA4 and other non-essential scripts |
| Support page and contact form                                     | ✅  | ✅     |                                                     |
| Feedback hub                                                      | ✅  | ✅     |                                                     |
| Shake to send feedback                                            | —   | ✅     |                                                     |
| Referral link                                                     | ✅  | ✅     | `/?ref=CODE`; see [Engagement](engagement.md)       |

## How it works

**Signing up.** A visitor registers from the website or the app. On the web, a sign-up that started
on a public lesson carries `?next=` so the user lands back in that course after onboarding. The
first-touch campaign data (where they came from) is saved with the account; see
[Website](website.md#analytics-and-attribution).

**Onboarding.** New users answer a questionnaire about their goals, confidence and topics of
interest. The answers produce a plan summary ("plan ready") and feed the Personalized Path described
in [Learning](learning.md). Users can finish later; the dashboard reminds them.

**Profile and settings.** The profile shows XP, streak, coins, badges, goals and recent activity.
Settings cover personal details, email reminder preferences, lesson sounds and animations, password
change, links to the legal pages, and account deletion. Billing is managed from the subscriptions
page; see [Plans and billing](plans-and-billing.md).

**Language.** The UI is fully available in English and Romanian. The choice is stored on the device
and sent to the API, which returns translated content where it exists and English otherwise.

**Sessions.** Logins use JWT access and refresh tokens. A 401 from the API means the session has
ended and the user is sent to log in; a 403 means "logged in but not allowed" (for example a course
that needs Plus) and shows an upgrade prompt instead.

**Support and feedback.** The support page holds help content and a contact form (stored as a
contact message for staff). The feedback hub collects feature requests and bug reports. On mobile,
shaking the device opens a feedback form.

**Staff tools.** Staff use the Django admin (`/admin/`) to manage content, users and translations.
Logged-in staff also get a pricing funnel dashboard (`/analytics`) and an admin mode inside the
lesson flow for editing lesson sections in place.

## Under the hood

| Piece                                                            | Where                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Users, profile, JWT, Google/Apple OAuth, entitlements, referrals | `backend/authentication/` (`UserProfile` in `models.py`)                    |
| Onboarding questionnaire                                         | `backend/onboarding/` (`QuestionnaireVersion`, `QuestionnaireProgress`)     |
| Support, contact and feedback                                    | `backend/support/`                                                          |
| Web auth screens and session handling                            | `frontend/src/components/auth/`, `packages/core/src/services/httpClient.ts` |
| Mobile auth and root bootstrap                                   | `mobile/app/(auth)/`, `mobile/app/_layout.tsx`                              |
| Mobile shake feedback                                            | `mobile/src/components/feedback/ShakeFeedbackModal.tsx`                     |
| Translations                                                     | `packages/core/src/locales/{en,ro}/`                                        |

## Known gaps

- Sign in with Apple is iOS-only; there is no Apple sign-in on the web.
- Staff dashboards are web-only.
- The author profile (`packages/core/src/constants/editorial.ts`) still needs a photo and a personal
  LinkedIn URL.
