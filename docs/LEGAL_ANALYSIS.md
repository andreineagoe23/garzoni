# Garzoni — Legal Documents Analysis

> Source-of-truth analysis for drafting **Privacy Policy**, **Terms of Service**,
> **Cookie Policy**, **Subscription / EULA**, **AI Disclosure**, and **Financial
> Disclaimer**. Compiled directly from the codebase, not from marketing copy.
>
> Last updated: 2026-05-02 — keep this file in sync when third-party services
> or data flows change.

---

## 1. Product Identity

| Field | Value |
|---|---|
| Product name | **Garzoni** |
| Tagline | Gamified Financial Learning Platform |
| Platforms | Web (`@garzoni/web`, React + Vite), iOS, Android (Expo / React Native) |
| Backend | Django 4.2 + DRF, PostgreSQL, Redis, Celery |
| Repo languages | Python (backend), TypeScript (web/mobile/core) |
| Domain (web) | TBD — confirm on Vercel/DNS |
| Mobile bundle IDs | TBD — confirm in `mobile/app.json` |
| Operator legal entity | **TBD — fill in (company name, registered address, company number)** |
| Contact email | Set via `CONTACT_EMAIL` / `DEFAULT_FROM_EMAIL` env vars |
| DPO / Privacy contact | **TBD** |

> **Action for legal docs:** confirm operating entity, jurisdiction (UK based on £/GBP pricing), registered address, and a published privacy/DPO contact email.

---

## 2. What the App Does (functional scope)

Garzoni is an interactive personal-finance education app with:

- Structured **learning paths**: Basic Finance, Investing, Crypto, Real Estate, Forex, Budgeting.
- **Lessons + quizzes** with progress tracking, streaks, hearts (lives), XP, badges.
- **Personalized learning path** generated from user goals, mastery, and an AI ranker.
- **AI Tutor** (chat, voice, exercise explanation, push nudges, weekly Coach Brief).
- **Receipt / statement scan** (Pro tier) — image → categorized spending + lesson recommendation.
- **Finance tools**: Portfolio Analyzer, Goals Reality Check, Economic Calendar, Economic Map, News, Market Explorer, Next Steps Engine.
- **Paper trading / simulated portfolio** (no real money trading).
- **Rewards / shop**: streak freezes, boosts, donation to causes, leaderboards.
- **Subscriptions**: Starter (free), **Plus £7.99/mo or £69/yr**, **Pro £11.99/mo or £79/yr** (7-day trial on yearly Plus/Pro).

> **Action for legal docs:** ToS must clarify Garzoni provides **education only**, not regulated financial advice; paper trading is simulation, not a brokerage service.

---

## 3. User Accounts & Authentication

**Sign-up methods** (file: `backend/authentication/`)

- Email + password (Django auth)
- **Google OAuth** (`GOOGLE_OAUTH_CLIENT_ID`, web + mobile via `@react-native-google-signin/google-signin`)
- **Sign in with Apple** (mobile, via `expo-apple-authentication`; stored as `apple_sub` field)
- Magic-login email tokens
- Password reset emails (django-rest-passwordreset)
- Optional **reCAPTCHA Enterprise** on sensitive endpoints (`verify_recaptcha_enterprise` in `views_auth.py`)
- Brute-force protection via **django-axes** + DRF throttles

**Session model:** JWT (access + refresh) via `djangorestframework-simplejwt`.

**Account deletion:** `POST /auth/delete-account/` (`backend/authentication/views_password.py::delete_account`). User-initiated hard-delete is supported.

**Data export:** No user-facing GDPR data-export endpoint exists. Only an admin command `export_for_postgres.py`.

> **Action for legal docs:**
> - Disclose Google/Apple SSO and that minimal profile data is received from those providers (email, name, avatar URL, stable subject ID).
> - If targeting EU/UK users, **add a self-service data-export endpoint** (Subject Access Request) — currently missing and required under GDPR Art. 15 / 20.

---

## 4. Personal Data Collected

### 4.1 Identity & contact (Django `auth.User` + `authentication.UserProfile`)

- Username, email, password (hashed, PBKDF2)
- Full name (first/last where provided)
- `profile_avatar` URL (often from Google/Apple)
- `apple_sub` (stable Apple user ID)
- `referral_code`, `referral_points`
- `expo_push_token` (mobile push)
- IP/user-agent at login (django-axes)

### 4.2 Financial profile (`authentication.UserProfile` + `onboarding.QuestionnaireProgress`)

- `goal_types` (list)
- `timeframe` (e.g. 1-3y)
- `risk_comfort` (low/medium/high)
- `income_range` (band, **not exact salary**)
- `savings_rate_estimate`
- `investing_experience`
- Onboarding answers (free-form JSON, includes `primary_goal`, `biggest_challenge`)

> Note: this is **self-declared** financial profile; no bank-account linkage, no Open Banking, no real KYC.

### 4.3 Behavioural / progress data

- `Mastery` per skill (proficiency 0-100, due_at, last_reviewed)
- `UserProgress` per course (completed lessons/sections, streaks)
- `LessonCompletion`, `SectionCompletion`
- `streak`, `hearts`, `points`, `earned_money` (in-app coins, not real money)
- Daily/weekly mission completions
- Activity heatmap

### 4.4 AI-tutor data (new in WS1–WS5)

- `support.Conversation` + `support.Message` — **persistent chat transcripts** keyed to user. Includes user prompts, assistant replies, tool-call payloads, rolling summary.
- `education.ContentEmbedding` — embeddings of curriculum (no user data).
- `education.PathPlan` — AI-generated reasoning per recommended course.
- Voice tutor (Pro): audio uploads → transcribed by Whisper → response audio → **audio not retained**, only transcript+response in `Conversation`.
- Receipt scan (Pro): image uploaded → analysed by GPT-4o vision → **image not retained server-side**, only the JSON analysis output is returned (currently not persisted; verify before claim).

### 4.5 Payment & subscription data

- `stripe_customer_id`, `stripe_subscription_id`, `stripe_payment_id`
- `subscription_plan_id`, `subscription_status`, `trial_end`, `has_paid`, `is_premium`
- `StripePayment` records (amount, currency, `stripe_payment_id`)
- On mobile: **RevenueCat** customer ID (App Store / Play Store IAP)
- Card numbers / CVC: **never touch our servers** — handled by Stripe / Apple / Google.

### 4.6 Tracking & analytics

- **Amplitude Analytics Browser** (`@amplitude/analytics-browser`) on web — event analytics, session, device, geo (derived from IP).
- **Sentry** (`@sentry/react`, `sentry-sdk[django]`) — error monitoring; can include stack traces and request metadata (PII scrubbing should be configured).
- **Customer.io** — Customer Data Platform + transactional emails + push (`customerio-reactnative`, server CDP via `CIO_CDP_API_KEY`). Tracks events tied to user ID.
- **Google reCAPTCHA Enterprise** — on auth endpoints.
- **FunnelEvent** model in `finance.models` — first-party funnel/event log (event_type, status, session_id, metadata JSON).

### 4.7 Cookies / local storage

- JWT refresh token cookie (httpOnly).
- `@react-native-async-storage/async-storage` and `expo-secure-store` on mobile (auth tokens, preferences).
- Web: localStorage / sessionStorage (`scrollToPathId`, theme, language, last-seen banners).

> **Action for legal docs:**
> - Privacy Policy must list every personal-data category above with **purpose** and **legal basis** (UK GDPR Art. 6).
> - Cookie Policy must enumerate first-party cookies + third-party set by Stripe Checkout, reCAPTCHA, Amplitude, Customer.io, Cloudinary, Sentry. A cookie banner with consent management is **required** for EU/UK users — confirm if implemented.

---

## 5. Third-Party Sub-Processors

| Vendor | Purpose | Data sent | Region |
|---|---|---|---|
| **OpenAI** | AI tutor (`gpt-4o-mini`, `gpt-4o`), embeddings (`text-embedding-3-small`), Whisper transcription, TTS (`tts-1`), GPT-4o vision (receipt scan) | User prompts, exercise context, financial profile via tools, audio (voice), images (scan) | US |
| **Stripe** | Payment processing (web), subscription billing, webhooks | Name, email, card data (direct to Stripe), billing address | US/IE |
| **RevenueCat** | Mobile IAP entitlement management | App user ID, purchase events | US |
| **Apple App Store** | iOS in-app purchases, Sign in with Apple | Email (private relay supported), Apple ID `sub`, purchase | Global |
| **Google Play / OAuth** | Android IAP, Google sign-in | Email, name, avatar, Google `sub`, purchase | Global |
| **Customer.io** | Email + push delivery, CDP events | Email, name, user ID, event payload (lesson done, streak, AI nudge) | US/EU configurable (`CIO_REGION`) |
| **Resend** (via django-anymail) | Transactional email (password reset, etc.) | Email, name, message body | EU/US |
| **SMTP (Gmail by default)** | Fallback email transport | Email contents | US |
| **Cloudinary** | Image hosting + transformations (lesson art, avatars) | Image binaries; URLs may include public IDs | US/global CDN |
| **Sentry** | Error tracking | Stack traces, request URL, user ID (if not scrubbed) | EU/US |
| **Amplitude** | Web analytics | Event names, properties, anonymized device/IP | US |
| **Google reCAPTCHA Enterprise** | Bot prevention on auth | reCAPTCHA token, IP, user-agent | US |
| **CoinGecko**, **Alpha Vantage**, **ExchangeRate-API** | Market data (stocks, crypto, forex) — read-only price queries | None user-specific (server-side fetch) | US/global |
| **Vercel** | Web hosting | Logs, request metadata | US/EU |
| **Railway** (per `mcp__railway-mcp-server`) | Backend hosting | Logs, server data | US |
| **Groq** (`groq>=0.12.0` in requirements) | Possible alternate LLM provider | Verify if used in prod | US |

> **Action for legal docs:**
> - Privacy Policy must include a **list of sub-processors** with links to their privacy policies. The table above is the starting point.
> - For GDPR: **Standard Contractual Clauses** are needed for US transfers (OpenAI, Stripe, Cloudinary, Sentry US instance, Customer.io US, Amplitude). Mention "appropriate safeguards under Art. 46 UK/EU GDPR".

---

## 6. Subscriptions & Billing

### Plans (from `backend/authentication/entitlements.py::PLAN_CATALOG`)

| Plan | Monthly | Yearly | Trial |
|---|---|---|---|
| Starter | £0 | — | — |
| Plus | £7.99 | £69 | 7 days (yearly only) |
| Pro | £11.99 | £79 | 7 days (yearly only) |

Currency: **GBP**. Channels: Stripe (web), Apple/Google IAP via RevenueCat (mobile).

### Auto-renewal & cancellation

- Stripe subscriptions auto-renew per Stripe config; cancellation via Stripe Customer Portal.
- Mobile IAP: Apple/Google standard auto-renewal; cancellation via the platform's subscription manager.
- Trial: 7 days on yearly Plus/Pro. `trial_end` is stored in `UserProfile`.

> **Action for legal docs (ToS / EULA):**
> - State auto-renewal terms clearly (required by Apple guidelines + EU Consumer Rights Directive).
> - State refund policy for each channel (Stripe-issued, Apple-issued, Google-issued — operator does not control mobile refunds).
> - State 14-day right of withdrawal under UK/EU consumer law and how trial interacts with it.
> - VAT/sales tax handling: confirm whether Stripe Tax is used.

---

## 7. AI Features — Disclosures Needed

Garzoni embeds OpenAI deeply. Legal docs must include an **AI Disclosure** section.

| Feature | Endpoint | Data sent to OpenAI | Notes |
|---|---|---|---|
| Chat tutor | `POST /api/proxy/openai/` | Prompt + persistent history (server-side) + system prompt with mastery + financial profile (via tools) | gpt-4o-mini (Free/Plus), gpt-4o (Pro) |
| Inline exercise explanation | `POST /api/exercises/explain/` | Question, correct answer, user answer, skill | Free 3/day, Plus/Pro unlimited |
| Personalized path | server cron / refresh | Onboarding answers, mastery summary | Daily re-eval; cached |
| Coach Brief | `GET /api/coach-brief/` | Weekly summary stats | Plus/Pro, cached 24h |
| Push nudge generation | Celery beat | Streak, weakest skill, plan tier | Daily |
| Voice tutor | `POST /api/voice-tutor/` | Audio file (Whisper) → text → TTS audio | Pro |
| Receipt scan | `POST /api/scan/` | Image (base64 to GPT-4o vision) | Pro, max 20 MB |
| Smart resume | `GET /api/smart-resume/` | Streak, active course, weak skills | All tiers, cached 24h |
| Embeddings (RAG) | server-side only | Lesson titles + descriptions (no user data) | text-embedding-3-small |

**Critical AI disclosures to add to ToS/Privacy:**

1. **Not financial advice.** Output is educational; users must not act on it as regulated advice.
2. **Hallucinations.** AI may produce inaccurate or misleading answers; the user must verify before acting.
3. **Data sent to OpenAI.** Prompt content + chat history + selected profile attributes leave EU/UK and go to OpenAI (US). OpenAI's API data is **not used to train models** (per OpenAI API ToS as of 2026), but state this explicitly.
4. **Data retention.** OpenAI retains API logs for up to 30 days for abuse monitoring, then deletes.
5. **Voice + image biometrics.** Receipts may incidentally contain card numbers, addresses; the policy must instruct users **not to upload** documents containing identifiers they don't want processed. Receipt images and voice audio are **not persisted server-side**, only the derived text/JSON analysis.
6. **Right to opt out / object.** User can avoid AI by not using the tutor; but personalized path uses GPT — give a way to disable AI personalization or document that it's a core feature of paid tiers.

---

## 8. Children's Data

No age gate or `min_age` field exists in the codebase. App Store / Play Store ratings will determine the apparent audience.

> **Action for legal docs:**
> - Set a **minimum age** (recommend 16+ for EU GDPR, 13+ for COPPA US elsewhere; or adopt 18+ given financial topic).
> - Add an age-confirmation checkbox at signup.
> - Add a parental-notice clause if you allow under-16/13 users in any market.

---

## 9. Marketing & Communications

- Email reminders default to **weekly** (`UserProfile.email_reminder_preference`), with a **GDPR-safe service vs. marketing distinction** noted in `backend/authentication/signals.py` ("service/transactional preferences ON; marketing OFF by default").
- Push notifications via Expo + Customer.io.
- Referral program (referral codes, points).

> **Action for legal docs:**
> - Privacy Policy must distinguish **transactional emails** (lawful basis: contract / legitimate interest) from **marketing emails** (lawful basis: consent, with an unsubscribe link).
> - Confirm the unsubscribe flow works for each channel.
> - Confirm GDPR-safe defaults claim is accurate by inspecting `signals.py`.

---

## 10. Security Posture (claims you can make)

- HTTPS-only (Vercel + Railway managed certs).
- Passwords hashed with Django default (PBKDF2-SHA256, 600k iterations as of Django 4.2).
- JWT access tokens with short TTL + refresh rotation.
- httpOnly + Secure cookies for refresh.
- `expo-secure-store` (Keychain/Keystore) for mobile token storage.
- django-axes (brute-force lockout) + DRF throttles + reCAPTCHA on sensitive endpoints.
- CORS restricted via `django-cors-headers`.
- Sentry for error monitoring (with PII scrubbing — **verify configuration**).
- Stripe + RevenueCat for payment isolation (PCI-DSS scope minimised — operator never sees card data).
- Rate-limited AI tutor (per-plan daily quotas + per-user token budget).

> **Action for legal docs:**
> - Don't claim ISO 27001 / SOC 2 unless certified.
> - Mention breach-notification commitment under UK GDPR Art. 33 (notify ICO within 72h).

---

## 11. User Rights (UK / EU GDPR)

| Right | Status in app |
|---|---|
| Access (Art. 15) | ❌ No self-service export. Only via support email. |
| Rectification (Art. 16) | ✅ Settings → profile edit. |
| Erasure (Art. 17) | ✅ `POST /auth/delete-account/`. Verify cascading deletes across `Conversation`, `StripePayment`, `Mastery`, etc. |
| Restriction (Art. 18) | Manual via support. |
| Portability (Art. 20) | ❌ Same as access — **gap**. |
| Object (Art. 21) | Manual via support. |
| Withdraw consent | Settings → email preferences (marketing); deleting account ends processing. |
| Complaint to supervisory authority | Mention ICO (UK) and equivalent in privacy policy. |

> **Action for legal docs / engineering:** add a `/api/auth/export-data/` endpoint that emits a JSON dump of the user's records (profile, progress, conversations, payments) to satisfy Art. 15/20. This is a known gap.

---

## 12. Intellectual Property

- Curriculum content (lessons, quiz questions, badge art) is the operator's property. Confirm whether any third-party content is licensed (e.g. Cloudinary-hosted images — operator-owned only?).
- AI-generated content (tutor replies, coach briefs, practice questions): **OpenAI assigns ownership of outputs to the API caller**, but outputs are not unique — the policy should explain users can use AI replies but operator owns the curriculum framing.
- User-generated content: chat messages, receipt images. Operator needs a **limited licence** from the user to process and store.

> **Action for ToS:**
> - "User content licence" clause: user grants Garzoni a worldwide, non-exclusive licence to process user inputs for the purpose of operating the service.
> - "Garzoni IP" clause: the curriculum, brand, code are operator IP and not licensed to users beyond personal use of the app.

---

## 13. Acceptable Use / Prohibited Conduct (ToS)

Recommended clauses given the AI features:

- No prompt injection / circumvention of AI safety.
- No upload of unlawful, defamatory, or third-party private data via voice or scan.
- No scraping or automated reuse of curriculum content.
- No use of paper-trading data to claim regulated advice for third parties.
- No reverse engineering, rate-limit evasion, or API abuse beyond stated quotas.
- Operator may suspend accounts for abuse; AI quotas are usage limits, not contractual minimums.

---

## 14. Financial Disclaimer (separate doc)

Garzoni handles finance topics, paper trading, and market data feeds. A **standalone Financial Disclaimer** is needed:

- Garzoni is an **education provider**, not authorised by the FCA / SEC / equivalent.
- Nothing in the app — including AI tutor output, personalized path, scan analysis, market data, or paper trading — constitutes investment advice, a recommendation, or a solicitation.
- Past performance ≠ future results.
- Paper trading is **simulated**; no real orders are placed.
- Market data (CoinGecko, Alpha Vantage, ExchangeRate-API) may be delayed and is provided as-is.
- Users should consult a regulated adviser before financial decisions.

This disclaimer should be linked from the chatbot UI, every tool page, and Settings.

---

## 15. Jurisdiction & Governing Law

Pricing in GBP and `tests/test_signup_email_defaults.py::"GDPR-safe"` annotations strongly suggest UK as primary jurisdiction.

> **Action for legal docs:**
> - Default governing law: **England & Wales** (or Scotland if registered there).
> - Consumer disputes: preserve EU consumer's right to local courts as required by Rome I / Brussels I bis.
> - Provide ODR link (`https://ec.europa.eu/consumers/odr`) per EU Reg. 524/2013 if selling to EU.

---

## 16. Documents to Produce (suggested set)

1. **Privacy Policy** — covers §3, §4, §5, §7 disclosures, §11 rights.
2. **Cookie Policy** — covers §4.6, §4.7.
3. **Terms of Service (web + mobile EULA)** — covers §6 billing, §10 security claims, §12 IP, §13 acceptable use, §15 jurisdiction.
4. **Subscription Terms / Auto-Renewal Disclosure** — required by Apple/Google rules.
5. **AI Disclosure & Acceptable AI Use** — covers §7.
6. **Financial Disclaimer** — covers §14.
7. **Refund Policy** — references §6 differences across Stripe / Apple / Google.
8. **DPA template** (Data Processing Agreement) — only if you'll have B2B customers; not required for B2C app.
9. **Sub-processor list** (publish at e.g. `garzoni.com/legal/subprocessors`).
10. **DSAR procedure / privacy contact form** — until self-service export ships.

---

## 17. Engineering Gaps to Close Before Publishing Docs

These are claims the policy will likely make that the codebase doesn't yet fully back:

| Gap | Priority |
|---|---|
| Self-service GDPR data export endpoint | **High** |
| Cookie consent banner (web) for EU/UK | **High** |
| Age gate at signup | **High** |
| Sentry PII scrubbing config (verify `before_send` hook) | Medium |
| Audit cascade-delete coverage on `delete_account` (does it delete `Conversation`, `Message`, `StripePayment`, `Mastery`, `UserProgress`, `PathPlan`?) | **High** |
| AI conversation retention policy (how long do we keep `Message` rows?) | Medium |
| Marketing-email double opt-in (UK PECR) | Medium |
| Disclosure of OpenAI region (US) at the chat surface | Low |
| Confirm receipt-scan images aren't logged in Sentry / Cloudinary | Medium |
| Verify reCAPTCHA cookie disclosure | Low |

---

## 18. Quick Reference: Where Things Live

```
backend/
  authentication/        # User, UserProfile, UserEmailPreference, Apple/Google OAuth, password reset
  finance/               # Stripe, paper trading, FunnelEvent, market-data proxies
  notifications/         # Customer.io integration, push, transactional email
  onboarding/            # QuestionnaireProgress (financial profile capture)
  education/             # Lessons, courses, Mastery, ContentEmbedding (RAG), PathPlan, AI tutor service
  support/               # AI conversation persistence, OpenAI service, voice + scan endpoints
  gamification/          # Streaks, hearts, missions, rewards
  reports/               # Internal reporting

frontend/src/            # React web app (Vite + Tailwind)
mobile/app/              # Expo Router app (iOS + Android)
packages/core/           # Shared TypeScript: API client, services, i18n, types
```

---

*This document is an internal working analysis for legal-doc drafting. It does not itself constitute legal advice. A solicitor (UK) or licensed attorney must review the final policies before publication.*
