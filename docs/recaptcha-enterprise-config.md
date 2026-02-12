# reCAPTCHA Enterprise config (single key)

We use **reCAPTCHA Enterprise** with the key from the monevo.educational@gmail.com console. There is one **site key** (used on the frontend and in the backend assessment). Backend verification uses the **Recaptcha Enterprise API** (createAssessment) with a **Google Cloud project** and **API key**.

## 1. reCAPTCHA key (console)

- **Display name**: e.g. "Verify you're not a robot."
- **Key ID (site key)**: `6LexDmIsAAAAACphH4dd8HSWtYiNjdsMKevIrKkp`
- **Type**: Website • Score
- **Domain list**: Add every domain where the app runs, e.g.:
  - `www.monevo.tech`
  - `monevo.tech` (if you use the root domain)
  - `localhost`
  - `127.0.0.1`

The **Secret key** in the console is for legacy integrations; we do **not** use it. Verification is done via the Enterprise API below.

## 2. Frontend

Set **one** env var (at build time, e.g. in Vercel):

- **`REACT_APP_RECAPTCHA_SITE_KEY`** = your reCAPTCHA key ID (same as above), e.g.
  `6LexDmIsAAAAACphH4dd8HSWtYiNjdsMKevIrKkp`

The app loads `https://www.google.com/recaptcha/enterprise.js?render=KEY` and calls `grecaptcha.enterprise.execute(key, { action: 'login' | 'register' })`.

## 3. Backend

Set these in the backend environment (e.g. Railway, `.env`):

- **`RECAPTCHA_SITE_KEY`** = same key ID as the frontend (used in the assessment `event.siteKey`).
- **`RECAPTCHA_ENTERPRISE_PROJECT_ID`** = your Google Cloud project ID.
  You can find it in the reCAPTCHA Admin / API URL, e.g. `project-9f648322-8205-4cdf-812`.
- **`RECAPTCHA_ENTERPRISE_API_KEY`** = a **Google Cloud API key** that has access to the reCAPTCHA Enterprise API.

### How to get the API key

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the **same project** as your reCAPTCHA key.
2. Go to **APIs & Services** → **Library** → search for **reCAPTCHA Enterprise API** → **Enable**.
3. Go to **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
4. (Recommended) Restrict the key: **Application restrictions** (e.g. IP if backend has fixed IPs) and **API restrictions** → restrict to **reCAPTCHA Enterprise API**.
5. Copy the key and set it as **`RECAPTCHA_ENTERPRISE_API_KEY`** in your backend env.

Optional:

- **`RECAPTCHA_REQUIRED_SCORE`** = minimum score (0.0–1.0). Default `0.3`. Lower = more permissive.

## 4. Summary

| Where        | Variable                         | Value |
|-------------|-----------------------------------|-------|
| Frontend    | `REACT_APP_RECAPTCHA_SITE_KEY`   | Key ID (e.g. `6LexDmIsAAAAACphH4dd8HSWtYiNjdsMKevIrKkp`) |
| Backend     | `RECAPTCHA_SITE_KEY`             | Same key ID |
| Backend     | `RECAPTCHA_ENTERPRISE_PROJECT_ID`| Google Cloud project ID (e.g. `project-9f648322-8205-4cdf-812`) |
| Backend     | `RECAPTCHA_ENTERPRISE_API_KEY`   | Google Cloud API key (Recaptcha Enterprise API enabled) |

After setting these, **rebuild** the frontend and **restart** the backend. Login and Register will use reCAPTCHA Enterprise; the “Verifying you’re human…” step will run and tokens will be verified via the createAssessment API.
