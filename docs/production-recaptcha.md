# Why reCAPTCHA works in dev but not in production

## How it works in dev

- Your **frontend** runs with `npm start` and loads `frontend/.env`.
- That file contains `REACT_APP_RECAPTCHA_SITE_KEY=...`.
- So at runtime `process.env.REACT_APP_RECAPTCHA_SITE_KEY` is set.
- In `App.tsx`, `RECAPTCHA_SITE_KEY` is non-empty, so the app is wrapped with `GoogleReCaptchaProvider`.
- On Login/Register, `executeRecaptcha` is available → the "Verifying you're human..." modal runs → a token is sent to the backend.
- The **backend** has `RECAPTCHA_PRIVATE_KEY` and verifies the token. Everything works.

## Why it fails in production (two common causes)

### 1. Site key not in the production build (most common)

In production the frontend is **built** on Vercel (or similar). Create React App bakes `REACT_APP_*` into the JavaScript **at build time**. So:

- If `REACT_APP_RECAPTCHA_SITE_KEY` was **not** set in Vercel when that build ran, it is **empty** in the production bundle.
- Then `RECAPTCHA_SITE_KEY` is `""` → the app is **not** wrapped with `GoogleReCaptchaProvider` → `executeRecaptcha` is always `null` → no token is ever sent → backend returns "Security verification is required".

Adding the variable in Vercel **after** a build does not change an already-built deployment. You must **trigger a new build** so the new value is embedded.

**Fix:**

1. **Vercel** → your project → **Settings** → **Environment Variables**.
2. Add **`REACT_APP_RECAPTCHA_SITE_KEY`** with the value of your reCAPTCHA v3 **site key** (the same as `RECAPTCHA_PUBLIC_KEY` on the backend).
   - No quotes, no spaces.
   - Apply to **Production** (and Preview if you want it there too).
3. **Redeploy** so a new build runs with this variable:
   - **Deployments** → three dots on the latest deployment → **Redeploy**, or
   - Push a new commit so Vercel builds again.
4. After the new deployment is live, try Register again. The popup should appear and registration should work.

### 2. Cookie consent blocking the reCAPTCHA script

We use our **own cookie banner** (see `docs/cookie-consent-legal.md`). reCAPTCHA is **necessary** for login/register security, so we do **not** gate it on consent: the reCAPTCHA script loads on first page load. If you add another CMP or script-blocker, ensure reCAPTCHA (`google.com/recaptcha`, `gstatic.com/recaptcha`) is allowed to load without waiting for consent so the Register flow works.

## Checklist

- [ ] `REACT_APP_RECAPTCHA_SITE_KEY` is set in Vercel (same value as backend’s public/site key).
- [ ] A **new build** was run **after** adding that variable (redeploy or new commit).
- [ ] If you use a third-party CMP, reCAPTCHA scripts are allowed to load (e.g. necessary); our own banner does not block them.
- [ ] Backend has `RECAPTCHA_PRIVATE_KEY` set (secret key from the **same** reCAPTCHA v3 key pair).

After that, production should behave like dev: the verification popup appears and reCAPTCHA works.
