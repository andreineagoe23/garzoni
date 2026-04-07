# Google OAuth consent screen – show "Sign in on Garzoni"

The text and links on the Google sign-in screen (e.g. "Sign in to garzoni-production.up.railway.app") are **not** set by your app code. They come from the **OAuth consent screen** in Google Cloud Console.

To show **"Sign in on Monevo"** and your own links:

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**.
2. Click **Edit app** (or set it up if you haven’t).
3. **App information**
   - **App name**: `Garzoni`
   - **User support email**: your support email (e.g. andreineagoe@garzoni.app).
   - **App logo** (optional): upload your Garzoni logo so it appears on the consent screen.
4. **App domain** (so the screen shows your site, not the backend host)
   - **Application home page**: `https://www.garzoni.app`
   - **Application privacy policy**: `https://www.garzoni.app/privacy-policy`
   - **Application terms of service**: `https://www.garzoni.app/terms-of-service`
5. **Authorized domains**
   - Add: `garzoni.app`
   - Add: `www.garzoni.app` if needed (sometimes inferred from home page).
   - Do **not** add the Railway domain here unless you must; the consent screen will use the **App domain** URLs above for the links users see.
6. **Developer contact information**: your email.
7. Save.

After publishing, the consent screen will show **"Sign in to Garzoni"** (or similar, based on App name) and the Privacy Policy / Terms of Service links will point to **www.garzoni.app**. The backend URL (e.g. garzoni-production.up.railway.app) is only used as the redirect target; the user-facing branding comes from the OAuth consent screen settings.

### Optional: in-page Google Sign-In (One Tap / button)

Login and register **use the redirect flow by default**: one “Sign in with Google” link that goes to the backend and then to Google. No client-side script required.

The backend also exposes `POST /api/auth/google/verify-credential/` and the frontend has an optional `GoogleSignIn` component for **in-page** sign-in (Google Identity Services). To use them you must:

- Set **Authorized JavaScript origins** in Google Cloud (Credentials → your OAuth client) to your frontend origins (e.g. `http://localhost:3000`, `https://www.garzoni.app`). Use the exact origin (scheme + host + port); add both `http://localhost:3000` and `http://127.0.0.1:3000` if you use both.
- Set `REACT_APP_GOOGLE_OAUTH_CLIENT_ID` in the frontend to the same value as the backend `GOOGLE_OAUTH_CLIENT_ID`, and render `GoogleSignIn` on the login/register pages.

If you get **403 "origin not allowed"**: the page origin must match a value in **Authorized JavaScript origins** exactly (check the address bar or `window.location.origin`). **Authorized redirect URIs** is a different list (for the redirect flow only).

### `redirect_uri_mismatch` locally

The backend sends Google a redirect URI of `{origin}/api/auth/google/callback`. It must **exactly** match an entry under **Authorized redirect URIs** (scheme, host, port, path).

- If your Web client lists `http://localhost:8000/api/auth/google/callback`, set **`GOOGLE_OAUTH_REDIRECT_BASE=http://localhost:8000`** in `backend/.env` when **`FRONTEND_URL`** is `http://localhost:3000`, or ensure **`GoogleOAuthInitView`** passes the request into `_google_oauth_redirect_uri` so DEBUG builds the URI from the **Host** that hit the API (typically `:8000` when the app calls `http://localhost:8000/api/...`).
- Add **`http://127.0.0.1:8000/api/auth/google/callback`** as well if you ever open the API via `127.0.0.1`.
