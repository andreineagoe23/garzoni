# Garzoni Canva Brand Kit — Upload Guide

For non-developers. Follow in order. You will need the files in this folder:
`tokens.json`, `palette.html`, `typography.html`, and the three logos in `../`.

---

## 1. Create the Brand Kit

1. Open Canva → click **Brand** in the left sidebar → **Brand Kits** → **Add new**.
2. Name it: **Garzoni**.
3. Add a short tagline in the description: _Gamified personal finance learning — editorial-meets-pragmatic._

## 2. Add Colours

Canva does not import JSON directly. Open `tokens.json` in any text editor for reference, or open `palette.html` in a browser for a visual swatch sheet.

In Canva → **Brand colors** → click **+** to add each colour group below. For each entry: click the **+**, paste the hex into the colour picker, and label it.

### Core Brand

- `#1d5330` — Brand Green
- `#2a7347` — Brand Green Bright
- `#ffd700` — Brand Gold
- `#e6c87a` — Gold Warm
- `#96700a` — Gold Muted

### Dark Surfaces

- `#0b0f14` — BG Dark
- `#070a0e` — BG Dark Deep
- `#111827` — Card Dark
- `#161f2e` — Elevated Dark
- `#e5e7eb` — Text Dark

### Light Surfaces

- `#f5f5f0` — BG Cream
- `#eae9e4` — BG Cream Deep
- `#ffffff` — Card Light
- `#fafaf8` — Elevated Light
- `#1a1a1a` — Text Light

### Semantic

- `#dc2626` — Error

## 3. Add Fonts

In Canva → **Brand fonts**.

1. **Heading font** → click **Add a heading font** → search **Fraunces** in Canva's font library → select it.
   - Default style: **Regular 400**.
   - Italic variant available — use it for accent quotes.
2. **Body font** → click **Add a body font** → search **Helvetica Neue**.
   - If unavailable in your Canva plan, fall back to **Helvetica** or **Arial** (already on Canva).
   - Default: **Regular 400** for body, **Medium 500** for emphasis.
3. **Accent font** → click **Add a font for stats / mono** → search **JetBrains Mono**.
   - Default: **Regular 400** (use for prices, percentages, code).

## 4. Upload Logos

In Canva → **Brand logos** → drag in each file from `garzoni/brand/`:

| File            | Use it when                                                                        |
| --------------- | ---------------------------------------------------------------------------------- |
| `logo.png`      | Designing on **light / cream** backgrounds                                         |
| `logo-dark.png` | Designing on **dark** backgrounds (#0b0f14, #111827)                               |
| `logo-mark.png` | Designing **avatars, favicons, tight squares**, or any time the wordmark won't fit |
| `logo-mark.svg` | Any Canva design where you want a scalable vector mark                             |

Rename each upload in Canva so the variant is obvious (e.g. _Garzoni — Light Bg_, _Garzoni — Dark Bg_, _Garzoni — Mark only_).

## 5. Brand Voice (Canva → Brand voice)

Paste this:

> Garzoni teaches personal finance through daily lessons, exercises, and tools. Voice: editorial but practical. We sound like a smart friend who explains markets without jargon. Direct, warm, never patronising. Use real numbers and concrete examples. Italics (in Fraunces) for emotional or conceptual emphasis. Mono (JetBrains Mono) for any number — prices, percentages, streaks.

## 6. Templates to Create (optional but recommended)

Create blank Canva templates for these canvases so future designs start on-brand:

- **Instagram post:** 1080 × 1080, background `#f5f5f0`
- **Instagram Story / TikTok:** 1080 × 1920, background `#0b0f14`
- **Instagram carousel slide:** 1080 × 1080, background `#f5f5f0`
- **OG image:** 1200 × 630, background `#0b0f14`, logo-dark.svg

In each template: use 20px (or scaled equivalent) rounded corners for cards, Fraunces for headlines, JetBrains Mono for any number.

---

**Verify the kit:** create a new Canva design, open the colour palette — all 16+ brand colours should appear under "Brand". Fonts dropdown should show Fraunces, Helvetica Neue, JetBrains Mono pinned at the top.
