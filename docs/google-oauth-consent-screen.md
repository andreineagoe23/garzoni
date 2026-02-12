# Google OAuth consent screen – show "Sign in on Monevo"

The text and links on the Google sign-in screen (e.g. "Sign in to monevo-production-bc08.up.railway.app") are **not** set by your app code. They come from the **OAuth consent screen** in Google Cloud Console.

To show **"Sign in on Monevo"** and your own links:

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen**.
2. Click **Edit app** (or set it up if you haven’t).
3. **App information**
   - **App name**: `Monevo`
   - **User support email**: your support email (e.g. monevo.educational@gmail.com).
   - **App logo** (optional): upload your Monevo logo so it appears on the consent screen.
4. **App domain** (so the screen shows your site, not the backend host)
   - **Application home page**: `https://www.monevo.tech`
   - **Application privacy policy**: `https://www.monevo.tech/privacy-policy`
   - **Application terms of service**: `https://www.monevo.tech/terms-of-service`
5. **Authorized domains**
   - Add: `monevo.tech`
   - Add: `www.monevo.tech` if needed (sometimes inferred from home page).
   - Do **not** add the Railway domain here unless you must; the consent screen will use the **App domain** URLs above for the links users see.
6. **Developer contact information**: your email.
7. Save.

After publishing, the consent screen will show **"Sign in to Monevo"** (or similar, based on App name) and the Privacy Policy / Terms of Service links will point to **www.monevo.tech**. The backend URL (e.g. monevo-production-bc08.up.railway.app) is only used as the redirect target; the user-facing branding comes from the OAuth consent screen settings.
