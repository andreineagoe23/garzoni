# Garzoni Brand

This folder is the **single source of truth** for the Garzoni visual identity (logo + palette + font stack). Every other place in the monorepo — web (`frontend/`), mobile (`mobile/`), email templates (`backend/core/templates/emails/`), and the Customer.io dashboard — mirrors what lives here.

> Edit these files first. Then propagate the changes to the downstream mirrors listed below.

---

## Files

| File            | Use                                                                                             | Source                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `logo.svg`      | Primary wordmark (black on transparent). Use on light backgrounds, navbar, auth pages, emails. | Copied from `backend/media/logo/garzoni-black.svg` (1024×544).                    |
| `logo-dark.svg` | White wordmark variant for dark backgrounds (landing hero, dark-mode auth, Customer.io dark).   | Recolor of `logo.svg` (`#000000` → `#ffffff`).                                    |
| `logo-mark.svg` | Square mark + wordmark composition, used as the app/icon mark on tight 1:1 surfaces.            | Copied from `backend/media/logo/garzoni-logo.svg` (1200×1200).                    |
| `og-image.png`  | 1200×630 social-share card (`og:image` / `twitter:image`).                                      | Composed from `garzoni-logo-white-rectangular.png` on `#0b0f14` brand-dark canvas. |

The PNG masters (square, rectangle-no-bg, white-bg, etc.) live in `backend/media/logo/` and are the upstream sources; they are also mirrored on Cloudinary under `garzoni/logo/*` for runtime delivery (favicon, emails, PWA icons before Phase 4 of the brand consolidation).

---

## Clear-space & minimum size

- **Clear space**: keep at least the height of the "G" of `Garzoni` on every side.
- **Minimum wordmark width**: 96 px on screen / 24 mm in print.
- **Minimum mark width**: 24 px on screen / 8 mm in print.

## Do / don't

- ✅ Use `logo.svg` on light, `logo-dark.svg` on dark.
- ✅ Anchor the mark to the 4-point grid (multiples of 4 px padding) in UI.
- ❌ Don't stretch or skew. Don't recolor to arbitrary hues — only the two palette golds (`#ffd700`, `#e6c87a`) or brand green (`#1d5330`) are allowed as solid recolors.
- ❌ Don't put the black wordmark on a dark or busy photo background.

---

## Color tokens

All hex values are defined canonically in `frontend/src/styles/brand.css` (see also the mirrors listed below).

| Token                 | Hex                        | Usage                                               |
| --------------------- | -------------------------- | --------------------------------------------------- |
| `--brand-green`       | `#1d5330`                  | Primary brand accent (buttons, highlights).         |
| `--brand-gold`        | `#ffd700`                  | Bright gold — CTAs, coin/reward UI, Sass `$accent`. |
| `--brand-gold-warm`   | `#e6c87a`                  | Warm gold — landing theme headings, dark surfaces.  |
| `--brand-bg-dark`     | `#0b0f14`                  | App-wide dark background, landing, PWA theme.       |
| `--brand-bg-card`     | `#111827`                  | Dark card / surface elevation.                      |
| `--brand-border-glass`| `rgba(255,255,255,0.12)`   | Glass border on dark surfaces.                      |
| `--brand-text`        | `#e5e7eb`                  | Primary text on dark surfaces.                      |
| `--brand-text-muted`  | `rgba(229,231,235,0.72)`   | Secondary text on dark surfaces.                    |

## Font stack

```
"Helvetica Neue", Helvetica, Arial, sans-serif
```

- iOS / macOS / most Linux desktop browsers: renders as Helvetica Neue.
- Windows: falls back to Arial (virtually identical metrics to Helvetica).
- Android (mobile app): `Platform.select` → `sans-serif` (system Roboto).
- Emails: same stack — Helvetica/Arial ship in every mail client.

No webfont is loaded. This is intentional: zero network cost, zero FOUT, and the logo is already Helvetica-adjacent sans-serif so the typography is cohesive.

---

## Downstream mirrors (update after editing this folder)

| Place                                             | What it mirrors                                            |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `frontend/src/styles/brand.css`                   | Color + font CSS custom properties (authoritative).        |
| `frontend/src/styles/scss/abstracts/_variables.scss` | `$primary`, `$accent`, `$font-family-base` — hex in sync. |
| `frontend/src/index.css` `.landing-theme`         | Landing dark palette — reads `var(--brand-*)`.             |
| `frontend/index.html`                             | Favicon + OG + JSON-LD logo URLs.                          |
| `frontend/public/manifest.json`                   | PWA icons + `theme_color` / `background_color`.            |
| `frontend/public/favicon*.*`, `logo-*.png`, `og-image.jpg` | Generated from this folder (Phase 4).           |
| `frontend/src/assets/logo/logo.svg` + `logo-light.svg` | React-importable copies.                               |
| `backend/core/templates/emails/_base.html`        | Email font + color tokens; `<img src>` via `BRAND_LOGO_URL`. |
| `backend/garzoni/settings.py` `BRAND_LOGO_URL`    | Runtime email-logo origin.                                 |
| `mobile/src/theme/brand.ts`                       | React Native brand object (hex + `Platform.select` font).  |
| `mobile/src/theme/palettes.ts`, `authBrand.ts`    | Re-export hex from `brand.ts`.                             |
| `mobile/app.json` `icon` / `splash` / `adaptiveIcon` / `web.favicon` | PNGs copied from this folder.       |
| Customer.io dashboard                             | Palette + font (see mapping below).                        |

## Customer.io dashboard mapping

Applied manually in Customer.io → Workspace Settings → Palette.

| Dashboard slot   | Before       | After                   | Rename            |
| ---------------- | ------------ | ----------------------- | ----------------- |
| `color-1`        | `#ffd700`    | `#ffd700`               | `gold-bright`     |
| `color-3`        | (wrong hex)  | `#1d5330`               | keep or `green`   |
| `color-4`        | `#000000`    | `#0b0f14`               | `bg-dark`         |
| `color-5`        | (glass)      | `rgba(255,255,255,0.12)`| `border-glass`    |
| (new)            | —            | `#111827`               | `bg-card`         |
| (new)            | —            | `#e6c87a`               | `gold-warm`       |
| `neutral-100`    | `#ffffff`    | `#e5e7eb`               | `text`            |
| (new)            | —            | `rgba(229,231,235,0.72)`| `text-muted`      |

Font: set the default body font to `"Helvetica Neue", Helvetica, Arial, sans-serif` (explicit stack) in Customer.io → Workspace Settings → Typography.
