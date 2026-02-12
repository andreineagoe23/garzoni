# Production auth checklist (login, register, Google OAuth, reCAPTCHA)

Use this when login, register, Google sign-in, or the reCAPTCHA popup don’t work in production.

## 1. reCAPTCHA (popup “Verifying you're human…”)

- **Backend (Railway)**
  - `RECAPTCHA_PRIVATE_KEY` = your reCAPTCHA v3 **secret** key.
  - If this is set, the backend **requires** a valid `recaptcha_token` on login/register.

- **Frontend (Vercel or wherever the app is built)**
  - `REACT_APP_RECAPTCHA_SITE_KEY` = your reCAPTCHA v3 **site** key (same key pair as above).
  - Must be set in the **build** environment (e.g. Vercel → Project → Settings → Environment Variables) and the app **rebuilt** after adding it.
  - If this is missing, the reCAPTCHA popup never appears and no token is sent → backend returns “Security verification is required”.

**Fix:** Set `REACT_APP_RECAPTCHA_SITE_KEY` in the frontend build env, redeploy the frontend, then try again. Optionally use “Sign in with Google” (no reCAPTCHA on that flow).

## 2. Google OAuth (Sign in with Google)

- **Backend**
  - `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` (no space after `=` in env).
  - `FRONTEND_URL` = exact frontend origin, e.g. `https://www.monevo.tech` (no trailing slash).

- **Google Cloud Console**
  - Authorized redirect URI must match exactly, e.g.
    `https://monevo-production-bc08.up.railway.app/api/auth/google/callback`
  - OAuth consent screen: app name and domains as in [google-oauth-consent-screen.md](./google-oauth-consent-screen.md).

- **After sign-in**
  - User is redirected to `FRONTEND_URL/auth/callback#access=...&next=...`.
  - If you see “Sign-in was interrupted” or “Missing access token”, the hash may be dropped by a proxy or redirect; ensure the redirect goes straight to your app and that nothing strips the URL fragment.

## 3. Refresh cookie (staying logged in after Google OAuth)

- Backend should use **Secure** and **SameSite=None** in production so the cookie is sent on cross-origin requests (frontend on `www.monevo.tech` calling backend on Railway).
- Do **not** set `REFRESH_COOKIE_DOMAIN` to `monevo.tech` when the cookie is set by the Railway backend (the browser would reject it). Leave it unset so the cookie is for the backend domain.

## 4. Username for Google sign-in accounts

- New users created via Google OAuth get a username derived from their email (e.g. `neagoeandrei23` or `neagoeandrei23_1` if there is a collision).
- This is intentional; they can change display name in profile/settings if needed.
