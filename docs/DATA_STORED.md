# What data we store

One-page summary for compliance and user transparency.

## Stored data

| Category | What | Sensitivity | Notes |
|----------|------|-------------|--------|
| **Profile** | goal_types, timeframe, risk_comfort, income_range, savings_rate_estimate, investing_experience, email_reminder_preference, dark_mode, etc. | Low | Used for tools and personalization. |
| **Portfolio** | Simulated portfolio entries (symbol, shares, notes) | Sensitive-ish | Used only for tools (insights, concentration). Not real brokerage data. |
| **Analytics / events** | Tool usage (tool_open, tool_complete, recommendation_click, tool_to_lesson_click), optionally gtag | Minimal, anonymized | Stored in localStorage and/or backend; no PII in event payloads. |
| **Auth** | User account (email, username, hashed password), JWT refresh tokens | Sensitive | Standard auth; password not stored in plain text. |
| **Progress** | Lesson/course progress, hearts, streaks, mission completion | Low | For learning UX. |

We do **not** store: real brokerage credentials, real portfolio balances, or payment card numbers (Stripe handles payments).

## Delete / reset

- **Delete account**: `DELETE /api/delete-account/` (authenticated). Deletes the user and cascades to profile, portfolio entries, and related data.
- **Reset profile (financial)**: `PUT /api/me/profile/` with empty or new values. No dedicated “reset all” endpoint; clear fields as needed.
- **Portfolio**: Delete entries via portfolio API; no single “delete all portfolio” endpoint unless you add one.

## Privacy policy

See the in-app Privacy Policy and legal pages for full wording. This doc is for internal and compliance reference.
