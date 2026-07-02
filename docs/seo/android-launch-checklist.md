# Android launch checklist (Play going public)

Status 2026-07-02: closed test 12 testers / 13 of 14 days. Day 14 → apply for
production access → answer closed-test questions → **Google review (days)** →
public. So public availability is _days_, not tomorrow. **Do not ship live Play
links until the store listing is publicly resolvable** (else they 404).

Package: `app.garzoni.mobile` · iOS App ID: `R44TJX7U3C.app.garzoni.mobile` ·
Play URL (once live): `https://play.google.com/store/apps/details?id=app.garzoni.mobile`

## BLOCKER — apex `.well-known` 307 (breaks Android App Links now)

`curl -sI https://garzoni.app/.well-known/assetlinks.json` → **307 → www**.
The Android intent filter (`mobile/app.json`) `autoVerify`s **both** `garzoni.app`
and `www.garzoni.app`. Android does **not** follow redirects when fetching
assetlinks → apex verification fails → links on `garzoni.app/...` open the
browser instead of the app. (Same 307 hits iOS apex AASA.)

**Fix (manual, Vercel dashboard — this is the long-open C3 item):** remove the
platform-level apex→www domain redirect so `frontend/vercel.json`'s redirect
(which already excludes `/.well-known/`) governs. Then verify:

```
curl -s -o /dev/null -w "%{http_code}\n" https://garzoni.app/.well-known/assetlinks.json   # want 200, not 307
curl -s -o /dev/null -w "%{http_code}\n" https://garzoni.app/.well-known/apple-app-site-association
```

Alternative if the redirect can't be removed: drop `garzoni.app` (apex) from the
Android `intentFilters` and iOS `associatedDomains`, keeping only `www` (which
serves 200). Apex links then just redirect to www in-browser (no app intercept).

## VERIFY — assetlinks fingerprints match Play signing

`frontend/public/.well-known/assetlinks.json` lists 2 SHA-256 fingerprints.
Confirm they equal **Play Console → App integrity → App signing** (both the
_Play app signing key_ and the _upload key_ certificate SHA-256). A mismatch =
autoVerify fails silently.

## FLIP ON PUBLIC AVAILABILITY (not before)

### 1. Schema — add Android to MobileApplication (`frontend/index.html`, ~L291)

```jsonc
"operatingSystem": "IOS, ANDROID",
// add a second Offer or keep price 0; add Play to download/install:
"downloadUrl": "https://play.google.com/store/apps/details?id=app.garzoni.mobile",
"installUrl":  "https://play.google.com/store/apps/details?id=app.garzoni.mobile",
```

(Keep the App Store URL too — use an `offers` array or `sameAs`/`downloadUrl`
list. Update `aggregateRating` if you want to combine store ratings.)

### 2. Homepage — Play badge + Android CTA (`Welcome.tsx`)

Today the hero has only the App Store button; DOM has zero `play.google.com`.
Add the Google Play badge next to the App Store button, linking to the Play URL.
Remove any interim "Android: use the web app" copy once the badge is live.

### 3. Lesson/guide footers + comparison pages

`ArticlePage`/lesson footers and the `garzoni-vs-*` guides say "web and iOS" /
link only the App Store. Add Play where the App Store is linked.

### 4. ASO — Play listing copy

Paste-ready Play title/short/full description + graphics notes are in
[phase-2-aso-copy.md](./phase-2-aso-copy.md). Fill the Play Console listing.

### 5. Post-launch

- IndexNow-submit changed URLs; request Play URL indexing.
- Update `docs/seo/*` + the `revenuecat-billing-topology` note if Android billing
  differs.
- Re-run the SEO/ASO probes below.

## Post-deploy verification (run after any of the above)

```
# frontend actually deployed (Phase 6):
curl -s https://www.garzoni.app/53fde4032ad192dc911e87f41973ce8d.txt   # want the key text, not SPA HTML
curl -s https://www.garzoni.app/ | grep -c "fonts.googleapis.com/css2" # want 0
# content seeded:
curl -s -o /dev/null -w "%{http_code}\n" https://garzoni-production.up.railway.app/api/public/articles/duolingo-for-money-best-apps/  # want 200
```
