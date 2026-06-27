# Garzoni Brand Guidelines

Single source of truth for visual identity across web, mobile, and email.

Token values live in [`tokens.css`](tokens.css) and [`tokens.json`](tokens.json). Visual references: [`palette.html`](palette.html), [`typography.html`](typography.html).

---

## 1. Logo

| File               | Use on                                           | Format              |
| ------------------ | ------------------------------------------------ | ------------------- |
| `../logo.png`      | Light / cream backgrounds (`#f5f5f0`, `#ffffff`) | PNG, transparent bg |
| `../logo-dark.png` | Dark backgrounds (`#0b0f14`, `#111827`)          | PNG, transparent bg |
| `../logo-mark.png` | Favicon, app icon, avatars, tight squares        | PNG, transparent bg |
| `../logo-mark.svg` | Any context where SVG is supported               | SVG                 |

> SVG versions of `logo.png` / `logo-dark.png` not yet available — use PNGs at 2×+ resolution.

**Clear-space:** min padding around the mark = ½ the height of the "G" mark, anchored to the 4px grid.

**Min sizes:** mark-only `24px`; wordmark `80px`.

**Never:** stretch, skew, recolour to non-brand hues, apply drop shadow / outer glow, fill with gradients, or place the black wordmark on a dark/photographic background.

---

## 2. Colours

### Core Brand (theme-independent)

| Token                | Hex       | Usage                                        |
| -------------------- | --------- | -------------------------------------------- |
| `brand-green`        | `#1d5330` | Primary brand green — CTAs, links, focus     |
| `brand-green-bright` | `#2a7347` | Hover, gradients, focus rings                |
| `brand-gold`         | `#ffd700` | Bright accent (streak pip, top-1 badge only) |
| `brand-gold-warm`    | `#e6c87a` | Editorial italic on dark                     |
| `brand-gold-muted`   | `#96700a` | Editorial italic on light                    |

### Dark Mode Surfaces

| Token               | Hex                      | Usage        |
| ------------------- | ------------------------ | ------------ |
| `bg-dark`           | `#0b0f14`                | Page bg      |
| `bg-dark-deep`      | `#070a0e`                | Deeper layer |
| `bg-card-dark`      | `#111827`                | Card         |
| `bg-elevated-dark`  | `#161f2e`                | Raised card  |
| `border-glass-dark` | `rgba(255,255,255,0.12)` | Card border  |
| `text-dark`         | `#e5e7eb`                | Primary text |
| `text-muted-dark`   | `rgba(229,231,235,0.72)` | Secondary    |
| `text-faint-dark`   | `rgba(229,231,235,0.40)` | Metadata     |

### Light Mode Surfaces

| Token                | Hex                   | Usage         |
| -------------------- | --------------------- | ------------- |
| `bg-light`           | `#f5f5f0`             | Cream page bg |
| `bg-light-deep`      | `#eae9e4`             | Deeper cream  |
| `bg-card-light`      | `#ffffff`             | Card          |
| `bg-elevated-light`  | `#fafaf8`             | Raised card   |
| `border-glass-light` | `rgba(0,0,0,0.12)`    | Card border   |
| `text-light`         | `#1a1a1a`             | Primary text  |
| `text-muted-light`   | `rgba(26,26,26,0.65)` | Secondary     |
| `text-faint-light`   | `rgba(26,26,26,0.40)` | Metadata      |

### Semantic

| Token          | Light                   | Dark                     |
| -------------- | ----------------------- | ------------------------ |
| `primary-soft` | `rgba(29,83,48,0.10)`   | `rgba(29,83,48,0.18)`    |
| `ghost-bg`     | `rgba(26,26,26,0.06)`   | `rgba(229,231,235,0.08)` |
| `error`        | `#dc2626`               | `#dc2626`                |
| `error-soft`   | `rgba(220,38,38,0.10)`  | `rgba(220,38,38,0.15)`   |
| `success`      | `#2a7347` (brand green) | `#2a7347`                |

---

## 3. Typography

| Role      | Family                                         | Weights         | Min size | Usage                                             |
| --------- | ---------------------------------------------- | --------------- | -------- | ------------------------------------------------- |
| Display   | `Fraunces` (variable, opsz 9–144, italic axis) | 300–700         | 18px     | h1/h2/h3, `.app-display`, `.app-em-gold` (italic) |
| Body / UI | `Helvetica Neue`, Helvetica, Arial, sans-serif | 400/500/600/700 | 13px     | Body, UI labels, buttons                          |
| Mono      | `JetBrains Mono`                               | 400 / 500       | 11px     | Stat values, prices, percentages, code            |

Google Fonts load:

```
https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=JetBrains+Mono:wght@400;500&display=swap
```

---

## 4. Spacing & Radius

**Spacing scale (4px grid):** `4, 8, 12, 16, 20, 24, 32, 48`

**Radius scale:**

| Token         | Value      | Usage                                                                                                |
| ------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `radius-sm`   | `6px`      | Tags, micro pills                                                                                    |
| `radius-md`   | `10px`     | Icon tiles                                                                                           |
| `radius-lg`   | `14px`     | `.app-card-sm`                                                                                       |
| `radius-card` | **`20px`** | **`.app-card`, `.app-card-raised`, email cards — canonical card radius across web + mobile + email** |
| `radius-pill` | `9999px`   | Badges, CTAs, progress                                                                               |

---

## 5. Do / Don't

**Do**

- Use `logo.svg` on light, `logo-dark.svg` on dark.
- Anchor logo to a 4px grid.
- Use `var(--brand-green)` / `var(--brand-green-bright)` for brand green UI.
- Use `.app-card` (20px radius) for primary surfaces.
- Use `.app-eyebrow` for kickers.
- Use `.app-em-gold` for editorial italic accents.
- Use `.app-mono` / `font-mono` for stat values, prices, percentages.

**Don't**

- Stretch or skew logos.
- Recolour to arbitrary hues — only `#1d5330`, `#2a7347`, `#ffd700`, `#e6c87a`, `#96700a` allowed for brand.
- Put black wordmark on dark or busy photo.
- Use Tailwind `emerald-*` for brand UI (reserved for semantic feedback: correct-answer states, portfolio gains).
- Hardcode `#f8fafc` as light background — canonical is `#f5f5f0` cream.
- Use card radius other than `20px` for primary cards.

---

## 6. Social Media Specs

| Surface                  | Canvas      |
| ------------------------ | ----------- |
| Instagram post (square)  | 1080 × 1080 |
| Instagram Story / TikTok | 1080 × 1920 |
| Instagram carousel slide | 1080 × 1080 |
| OG / link preview image  | 1200 × 630  |

Reference: `../og-image.png` for OG canvas template.
