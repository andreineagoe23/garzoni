# reCAPTCHA works in dev but not in production

Stack note: the web app is **Vite**, not Create React App. The site key is read as
`import.meta.env.VITE_RECAPTCHA_SITE_KEY` in [`frontend/src/AppRoot.tsx:113`](../../frontend/src/AppRoot.tsx#L113).
`REACT_APP_RECAPTCHA_SITE_KEY` still resolves as a **legacy fallback only** (`envPrefix` in
`frontend/vite.config.ts:131` accepts both prefixes) — do not use it for new setups.

Key config for the backend: [`recaptcha-enterprise-config.md`](recaptcha-enterprise-config.md).

## How it works

1. Web reads `VITE_RECAPTCHA_SITE_KEY` at **build time**. If it is empty, `AppRoot.tsx:129` never
   wraps the tree in `RecaptchaEnterpriseProvider`, `executeRecaptcha` is always `null`, and no
   token is ever sent.
2. Login/Register run `executeRecaptcha`, show the "Verifying you're human…" modal, and post the token.
3. Backend verifies via the Enterprise createAssessment API using `RECAPTCHA_SITE_KEY`,
   `RECAPTCHA_ENTERPRISE_PROJECT_ID` and `RECAPTCHA_ENTERPRISE_API_KEY`
   (`backend/settings/settings.py:729-741`), scoring against `RECAPTCHA_REQUIRED_SCORE`.

Production refuses to boot with reCAPTCHA disabled: `settings.py:729-730` raises
`ImproperlyConfigured` if `RECAPTCHA_DISABLED` is set outside dev.

## Cause 1 — site key missing from the production build (most common)

Vite bakes `VITE_*` into the bundle **at build time**. Adding the variable in Vercel after a build
does nothing to that deployment.

1. Vercel → project → Settings → Environment Variables.
2. Add `VITE_RECAPTCHA_SITE_KEY` = the reCAPTCHA **key ID** (same value as backend
   `RECAPTCHA_SITE_KEY`). No quotes, no spaces. Apply to Production (and Preview if wanted).
3. **Redeploy** — Deployments → ⋯ → Redeploy, or push a commit. The value only lands in a new build.

## Cause 2 — CSP blocks the reCAPTCHA origins

`vercel.json` ships a strict `Content-Security-Policy`. reCAPTCHA needs
`https://www.google.com` and `https://www.gstatic.com` in `script-src`, and
`https://www.google.com` + `https://recaptcha.google.com` in `frame-src`. Both are present today —
if you edit the CSP, keep them, or the widget silently fails in production only.

## Cause 3 — consent banner blocking the script

Garzoni uses its own cookie banner ([`cookie-consent-legal.md`](cookie-consent-legal.md)).
reCAPTCHA is **necessary** for login/register security, so it is deliberately not gated on consent.
If you add a third-party CMP or script blocker, allow `google.com/recaptcha` and
`gstatic.com/recaptcha` to load pre-consent or Register breaks.

## Checklist

- [ ] `VITE_RECAPTCHA_SITE_KEY` set in Vercel, same value as the backend site key
- [ ] A **new build** ran after adding it
- [ ] `vercel.json` CSP still allows the Google/gstatic reCAPTCHA origins
- [ ] No CMP is blocking the script pre-consent
- [ ] Backend has `RECAPTCHA_SITE_KEY`, `RECAPTCHA_ENTERPRISE_PROJECT_ID`, `RECAPTCHA_ENTERPRISE_API_KEY`
- [ ] `RECAPTCHA_DISABLED` is **not** set in production (the app will refuse to start)

## Registration still failing? Wider checklist

**Web**
- `VITE_BACKEND_URL` must point at the real API (`https://…/api`, or the site origin without `/api` —
  it is normalized in `packages/core/src/services/backendUrl.ts`). Unset means same-origin, which
  404s when the backend is on another host. On Vercel, same-origin *is* correct because
  `vercel.json` rewrites `/api/*` to Railway.

**Backend**
- `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` must include the web origin.
- Cross-subdomain cookies: with web on `garzoni.app` and API on `api.garzoni.app`, set
  `REFRESH_COOKIE_DOMAIN=.garzoni.app` and `REFRESH_COOKIE_SAMESITE=Lax` (or `None` + Secure for
  true cross-site). Otherwise the refresh cookie is dropped and the user looks logged out after register.
- Rate limits: `REGISTER_THROTTLE_RATE` and `LOGIN_THROTTLE_RATE` are env-overridable; django-axes
  lockout also applies.

**Working state**: the verification modal appears on submit, the request succeeds, and the user lands
on onboarding. When the site key is missing the UI falls back to
"Security verification is required. Please refresh the page and try again, or sign in with Google."
