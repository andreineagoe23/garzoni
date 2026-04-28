# Garzoni Brand

This folder is the **single source of truth** for the Garzoni visual identity (logo + palette + font stack). Every other place in the monorepo — web (`frontend/`), mobile (`mobile/`), email templates (`backend/core/templates/emails/`), and the Customer.io dashboard — mirrors what lives here.

> Edit these files first. Then propagate the changes to the downstream mirrors listed below.

---

## Files

| File            | Use                                                                                            | Source                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `logo.svg`      | Primary wordmark (black on transparent). Use on light backgrounds, navbar, auth pages, emails. | Copied from `backend/media/logo/garzoni-black.svg` (1024×544).                     |
| `logo-dark.svg` | White wordmark variant for dark backgrounds (landing hero, dark-mode auth, Customer.io dark).  | Recolor of `logo.svg` (`#000000` → `#ffffff`).                                     |
| `logo-mark.svg` | Square mark + wordmark composition, used as the app/icon mark on tight 1:1 surfaces.           | Copied from `backend/media/logo/garzoni-logo.svg` (1200×1200).                     |
| `og-image.png`  | 1200×630 social-share card (`og:image` / `twitter:image`).                                     | Composed from `garzoni-logo-white-rectangular.png` on `#0b0f14` brand-dark canvas. |

The PNG masters (square, rectangle-no-bg, white-bg, etc.) live in `backend/media/logo/` and are the upstream sources; they are also mirrored on Cloudinary under `garzoni/logo/*` for runtime delivery (favicon, emails, PWA icons before Phase 4 of the brand consolidation).

---

## Clear-space & minimum size

- **Clear space**: keep at least the height of the "G" of `Garzoni` on every side.
- **Minimum wordmark width**: 96 px on screen / 24 mm in print.
- **Minimum mark width**: 24 px on screen / 8 mm in print.

## Do / don't

- ✅ Use `logo.svg` on light, `logo-dark.svg` on dark.
- ✅ Anchor the mark to the 4-point grid (multiples of 4 px padding) in UI.
- ✅ Use `var(--primary)` / `var(--primary-bright)` for all brand green UI elements.
- ✅ Use `.app-card` (via `<GlassCard>`) for content surfaces — 22px radius, white on cream.
- ✅ Use `.app-eyebrow` for section kickers, `.app-em-gold` for editorial italic accents.
- ✅ Use `.app-mono` / `font-mono` for stat values, prices, percentages.
- ❌ Don't stretch or skew. Don't recolor to arbitrary hues — only the two palette golds (`#ffd700`, `#e6c87a`) or brand green (`#1d5330`) are allowed as solid recolors.
- ❌ Don't put the black wordmark on a dark or busy photo background.
- ❌ Don't use Tailwind `emerald-*` for brand UI. Reserved for semantic feedback only: correct-answer highlights in exercises and positive financial value indicators in PortfolioAnalyzer.
- ❌ Don't hardcode `#f8fafc` as the light background — the canonical light page bg is `#f5f5f0` (cream).

---

## Color tokens

All hex values are defined canonically in `frontend/src/styles/brand.css`.

### Always-on (theme-independent)

| Token                   | Hex / value     | Usage                                                      |
| ----------------------- | --------------- | ---------------------------------------------------------- |
| `--brand-green`         | `#1d5330`       | Primary brand accent — buttons, active states.             |
| `--brand-green-rgb`     | `29, 83, 48`    | For `rgba()` compositions.                                 |
| `--brand-gold`          | `#ffd700`       | Bright gold — streak pip, #1 leaderboard badge only.       |
| `--brand-gold-warm`     | `#e6c87a`       | Warm gold — editorial italic accents, achievement moments. |
| `--brand-gold-warm-rgb` | `230, 200, 122` | For `rgba()` compositions.                                 |

### Dark mode surface tokens

| Token                  | Hex / value              | Usage                                              |
| ---------------------- | ------------------------ | -------------------------------------------------- |
| `--brand-bg-dark`      | `#0b0f14`                | App-wide dark page background, landing, PWA theme. |
| `--brand-bg-card`      | `#111827`                | Dark card / surface elevation.                     |
| `--brand-border-glass` | `rgba(255,255,255,0.12)` | Glass border on dark surfaces.                     |
| `--brand-text`         | `#e5e7eb`                | Primary text on dark surfaces.                     |
| `--brand-text-muted`   | `rgba(229,231,235,0.72)` | Secondary text on dark surfaces.                   |

### Web light mode tokens (defined in `_light-mode.scss`)

| Token                      | Hex / value            | Usage                                               |
| -------------------------- | ---------------------- | --------------------------------------------------- |
| `--bg-color`               | `#f5f5f0`              | Cream/ivory page background — signature light look. |
| `--bg-deep`                | `#eae9e4`              | Deeper cream for nav underlay, nested sections.     |
| `--card-bg`                | `#ffffff`              | White cards lifted off cream background.            |
| `--color-surface-elevated` | `#fafaf8`              | Raised surface for secondary cards / hover states.  |
| `--primary-soft`           | `rgba(29,83,48,0.10)`  | Green-tinted background for badges and active rows. |
| `--ghost-bg`               | `rgba(26,26,26,0.06)`  | Ultra-faint tint for ghost / inactive areas.        |
| `--faint-text`             | `rgba(26,26,26,0.40)`  | Eyebrow labels, metadata, secondary faint text.     |
| `--border-soft`            | `rgba(0,0,0,0.06)`     | Inner dividers (card rows, accordion separators).   |
| `--gold-warm`              | `#96700a`              | Muted gold for light-mode italic accents.           |
| `--error-soft`             | `rgba(220,38,38,0.10)` | Error badge background.                             |

### Web dark mode extras (defined in `_dark-mode.scss`)

| Token            | Hex / value              | Usage                                     |
| ---------------- | ------------------------ | ----------------------------------------- |
| `--bg-deep`      | `#070a0e`                | Deepest background (behind nav).          |
| `--primary-soft` | `rgba(29,83,48,0.18)`    | Green-tinted badges on dark surfaces.     |
| `--ghost-bg`     | `rgba(229,231,235,0.08)` | Ultra-faint tint on dark.                 |
| `--faint-text`   | `rgba(229,231,235,0.40)` | Eyebrow / metadata text on dark.          |
| `--border-soft`  | `rgba(255,255,255,0.06)` | Subtle inner dividers on dark.            |
| `--gold-warm`    | `#e6c87a`                | Warm gold italic accents (same as brand). |

---

## Font stack

### Body (UI)

Token: `--brand-font-primary`

```
"Helvetica Neue", Helvetica, Arial, sans-serif
```

- iOS / macOS / most Linux: Helvetica Neue.
- Windows: Arial (virtually identical metrics).
- Android (mobile): `Platform.select` → `sans-serif` (system Roboto).
- Emails: same stack — ships in every mail client, zero FOUT.

### Display (editorial headings)

Token: `--brand-font-display`

```
"Fraunces", "Helvetica Neue", serif
```

Loaded via Google Fonts in `frontend/index.html` (variable font, opsz 9–144, wght 300–700 + italic axis). Applied globally to `h1, h2, h3` via `_typography.scss` at weight 400 with letter-spacing −0.5px. Components using `font-bold` Tailwind override to Fraunces 700 — both are valid. The editorial pattern `<em class="app-em-gold">` uses Fraunces italic at weight 400.

### Mono (numbers, code, stats)

Token: `--brand-font-mono`

```
"JetBrains Mono", ui-monospace, monospace
```

Loaded via Google Fonts in `frontend/index.html` (wght 400–500). Use for stat values, percentages, prices, and code via `.app-mono` CSS class or `font-mono` Tailwind utility.

---

## Design system utilities (web)

Defined in `frontend/src/styles/app-theme.css`. Key classes:

| Class                                        | What it does                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `.app-card`                                  | White card, **22px radius**, subtle shadow — standard content surface. |
| `.app-card-raised`                           | Slightly elevated surface (`#fafaf8` light / `#161f2e` dark).          |
| `.app-card-sm`                               | 14px-radius compact card for widgets.                                  |
| `.app-display`                               | Fraunces, weight 400, tight tracking — for headings not using `h1–h3`. |
| `.app-eyebrow`                               | 11px uppercase tracking-[2px] — section kicker labels.                 |
| `.app-em-gold`                               | Fraunces italic, gold-warm color — editorial accent on heading words.  |
| `.app-mono`                                  | JetBrains Mono — numbers, prices, stats.                               |
| `.app-badge`                                 | Inline pill (11px, 600 weight, letterSpacing 0.8px).                   |
| `.app-badge-primary`                         | Green-tinted pill badge.                                               |
| `.app-badge-error`                           | Red-tinted pill badge.                                                 |
| `.app-action-primary`                        | Green gradient action row / banner.                                    |
| `.app-ghost`                                 | Ultra-faint tinted background (no elevation).                          |
| `.app-faint`                                 | Faint text color (eyebrows, metadata).                                 |
| `.app-cta-btn`                               | Full-width green gradient primary CTA button.                          |
| `.app-progress-track` / `.app-progress-fill` | Progress bar with glow effect.                                         |
| `.app-input`                                 | Themed input with green focus ring.                                    |
| `.app-section-glow`                          | Subtle radial green glow behind section headers.                       |

Use `.app-card` via the `<GlassCard>` React component in `frontend/src/components/ui/GlassCard.tsx`.

---

## Tailwind semantic tokens (web)

Defined in `frontend/tailwind.config.cjs`, resolved from CSS custom properties:

| Tailwind class         | CSS variable               | Light value          | Dark value          |
| ---------------------- | -------------------------- | -------------------- | ------------------- |
| `bg-surface-page`      | `--color-surface-page`     | `#f5f5f0` (cream)    | `#0b0f14`           |
| `bg-surface-card`      | `--color-surface-card`     | `#ffffff`            | `#111827`           |
| `bg-surface-elevated`  | `--color-surface-elevated` | `#fafaf8`            | `#161f2e`           |
| `text-content-primary` | `--color-text-primary`     | `#1a1a1a`            | `#e5e7eb`           |
| `text-content-muted`   | `--color-text-muted`       | `rgba(26,26,26,.65)` | `rgba(229,235,.55)` |
| `bg-brand-primary`     | `--color-brand-primary`    | `#1d5330`            | `#1d5330`           |

---

## Downstream mirrors (update after editing this folder)

| Place                                                                | What it mirrors                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `frontend/src/styles/brand.css`                                      | Color + font CSS custom properties (authoritative for web).                  |
| `frontend/src/styles/scss/abstracts/_variables.scss`                 | `$primary`, `$accent`, `$font-family-base`; `--bg-color` must be `#f5f5f0`.  |
| `frontend/src/styles/scss/themes/_light-mode.scss`                   | Full light-mode token set including cream bg, primary-soft, ghost, faint.    |
| `frontend/src/styles/scss/themes/_dark-mode.scss`                    | Full dark-mode token set including bg-deep, primary-soft, ghost, faint.      |
| `frontend/src/styles/scss/base/_typography.scss`                     | Global `h1, h2, h3` → Fraunces; `.app-mono` / `.font-mono` → JetBrains Mono. |
| `frontend/src/styles/app-theme.css`                                  | Design-system utility classes (cards, badges, buttons, progress bars).       |
| `frontend/src/index.css`                                             | Body default bg (`#f5f5f0`) + font; `.landing-theme` dark palette aliases.   |
| `frontend/index.html`                                                | Google Fonts load (Fraunces + JetBrains Mono); favicon + OG + JSON-LD.       |
| `frontend/public/manifest.json`                                      | PWA icons + `theme_color` / `background_color`.                              |
| `frontend/src/assets/logo/logo.svg` + `logo-light.svg`               | React-importable copies.                                                     |
| `backend/core/templates/emails/_base.html`                           | Email font + color tokens; `<img src>` via `BRAND_LOGO_URL`.                 |
| `backend/garzoni/settings.py` `BRAND_LOGO_URL`                       | Runtime email-logo origin.                                                   |
| `mobile/src/theme/brand.ts`                                          | React Native brand object (hex + `Platform.select` font).                    |
| `mobile/src/theme/palettes.ts`, `authBrand.ts`                       | Re-export hex from `brand.ts`.                                               |
| `mobile/app.json` `icon` / `splash` / `adaptiveIcon` / `web.favicon` | PNGs copied from this folder.                                                |
| Customer.io dashboard                                                | Palette + font (see mapping below).                                          |

---

## Customer.io dashboard mapping

Applied manually in Customer.io → Workspace Settings → Palette.

| Dashboard slot | Before      | After                    | Rename          |
| -------------- | ----------- | ------------------------ | --------------- |
| `color-1`      | `#ffd700`   | `#ffd700`                | `gold-bright`   |
| `color-3`      | (wrong hex) | `#1d5330`                | keep or `green` |
| `color-4`      | `#000000`   | `#0b0f14`                | `bg-dark`       |
| `color-5`      | (glass)     | `rgba(255,255,255,0.12)` | `border-glass`  |
| (new)          | —           | `#111827`                | `bg-card`       |
| (new)          | —           | `#e6c87a`                | `gold-warm`     |
| `neutral-100`  | `#ffffff`   | `#e5e7eb`                | `text`          |
| (new)          | —           | `rgba(229,231,235,0.72)` | `text-muted`    |

Font: set the default body font to `"Helvetica Neue", Helvetica, Arial, sans-serif` in Customer.io → Workspace Settings → Typography.

---

## Web rebranding pass (2025-04)

Changes applied to match the `garzoni-welcome-page` design prototype:

- **Light mode background** — `#f8fafc` → `#f5f5f0` (cream/ivory). Fixed in `_light-mode.scss`, `_variables.scss`, `index.css`, and `app-theme.css` fallback values.
- **Fonts** — Added JetBrains Mono to Google Fonts load alongside Fraunces. Both exposed as `--brand-font-mono` / `--brand-font-display` in `brand.css`.
- **Global headings** — `h1, h2, h3` now use Fraunces globally via `_typography.scss` (weight 400, letter-spacing −0.5px).
- **Card radius** — Unified to **22px** in `.app-card` / `.app-card-raised` to match prototype (was 20px).
- **New tokens** — `--bg-deep`, `--primary-soft`, `--ghost-bg`, `--faint-text`, `--border-soft`, `--gold-warm`, `--error-soft` added to both light and dark theme files.
- **New utility classes** — `.app-card-raised`, `.app-mono`, `.app-ghost`, `.app-faint`, `.app-badge`, `.app-badge-primary`, `.app-badge-error`, `.app-action-primary` added to `app-theme.css`.
- **Chatbot** — Replaced `#4ade80` (neon lime) with `#2a7347` (`--primary-bright`) in link buttons and quick-reply pills.
- **Off-brand greens purged** — `emerald-*` removed from: reward/donate buttons, skill-unlock badges, coin stack active state, entitlement matrix feature icons, auth success banners, register referral validation text, reset-password button. All replaced with `var(--primary)` / `var(--primary-bright)` / `var(--primary-soft)`.
- **Missions weekly tab** — Summary stats (missions remaining, XP earned/remaining, XP badge) now update when switching between Daily and Weekly tabs. Previously always showed daily data.
- **Support page** — Header updated to `app-eyebrow` kicker + Fraunces display sizing; FAQ category chips use `app-badge app-badge-primary`.
