# Brand Cleanup Report

Findings from the 2026-05-11 brand audit. Some items are fixed by the same PR that introduces `brand/kit/`; others are flagged for follow-up. Status column: **DONE** (fixed in this PR), **TODO** (deferred).

---

## 1. Wrong light background (`#f8fafc` → `#f5f5f0`)

| File                                                     | Line | Current                                              | Should be          | Token                    | Status            |
| -------------------------------------------------------- | ---- | ---------------------------------------------------- | ------------------ | ------------------------ | ----------------- |
| `frontend/src/components/landing/InteractiveSection.tsx` | 91   | `bg-[color:var(--input-bg,#f8fafc)]`                 | fallback `#f5f5f0` | `--bg-light`             | DONE              |
| `frontend/src/components/landing/marketing.css`          | 867  | `--bg: #f8fafc;`                                     | `--bg: #f5f5f0;`   | `--bg-light`             | DONE              |
| `frontend/src/components/landing/marketing.css`          | 870  | `--surface-raised: #f8fafc;`                         | `#fafaf8`          | `--bg-elevated-light`    | DONE              |
| `mobile/src/components/auth/AuthScreenLayout.tsx`        | 44   | `backgroundColor: isDark ? brand.bgDark : "#f8fafc"` | `: palette.bg`     | mobile `lightPalette.bg` | DONE              |
| `frontend/src/components/landing/welcome.css`            | 25   | comment `#f8fafc`                                    | comment only       | n/a                      | (comment, ignore) |
| `mobile/src/theme/palettes.ts`                           | 47   | comment `// cream — was #f8fafc`                     | (historical)       | n/a                      | (comment, ignore) |

## 2. Off-brand green (`#4ade80` / `emerald-*`)

**Allowed contexts** (exercise correct-answer feedback, portfolio gains): keep as-is.

| File                                                            | Line                   | Current                              | Verdict                                                 | Status        |
| --------------------------------------------------------------- | ---------------------- | ------------------------------------ | ------------------------------------------------------- | ------------- |
| `frontend/src/components/landing/InteractiveSection.tsx`        | 83                     | `bg-emerald-500/10 text-emerald-500` | `bg-[var(--primary-soft)] text-[var(--primary-bright)]` | DONE          |
| `frontend/src/components/profile/ReferralLink.tsx`              | 57                     | `bg-emerald-500/10`                  | `bg-[var(--primary-soft)]`                              | DONE          |
| `frontend/src/components/landing/landing-page-prototype.html`   | 11                     | inline `#4ade80`                     | Prototype file — not served in prod                     | OK (deferred) |
| `frontend/src/components/exercises/*.tsx`                       | many                   | `emerald-500/*` correct-state        | ALLOWED — semantic feedback                             | OK            |
| `frontend/src/components/tools/PortfolioAnalyzer.tsx`           | 1091, 1159, 1522, 1704 | `emerald-*` gain indicators          | ALLOWED — portfolio gains                               | OK            |
| `frontend/src/components/courses/LessonCheckpointQuizModal.tsx` | 213                    | `border-emerald-500/40`              | ALLOWED — correct answer                                | OK            |
| `mobile/app/chat.tsx`                                           | 746, 798               | `color: "#4ade80"`                   | `brand.goldWarm` (#e6c87a) — legible accent on dark bg  | DONE          |
| `mobile/app/tools/portfolio/index.tsx`                          | 310, 327               | `dark ? "#4ade80" : "#2e7d32"`       | ALLOWED — portfolio gains                               | OK            |

## 3. Email templates — hardcoded `#1d5330` button bg

15 templates each hardcode `background: #1d5330;` on their CTA button. Inline styles are required for email-client support (Gmail/Outlook strip classes). The hex is brand-correct (`--brand-green`), so the duplication is acceptable. Only `_base.html` (card surface) is unified here.

| File                                                                                | Change                                                       | Status         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------- |
| `backend/core/templates/emails/_base.html` (card)                                   | radius `16px` → `20px`, border `0.1` → `0.12`                | DONE           |
| 15 child templates × inline `background: #1d5330; border-radius: 12px;` CTA buttons | Value is brand-correct; inline is required for email clients | OK (no change) |

## 4. Stale / off-brand tokens in SCSS

| File                                                 | Line  | Current                                        | Should be                                                                              | Status                                                         |
| ---------------------------------------------------- | ----- | ---------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `frontend/src/styles/scss/themes/_light-mode.scss`   | 22–24 | `--accent: #c09040; --accent-bright: #b8860b;` | Remove — not in brand. Replace consumers with `var(--gold-warm)` / `var(--brand-gold)` | DONE (removed; aliases added pointing to gold-warm for safety) |
| `frontend/src/styles/scss/abstracts/_variables.scss` | 21    | `$success: #4caf50`                            | `$success: #2a7347` (brand green)                                                      | DONE                                                           |
| `frontend/src/styles/scss/abstracts/_variables.scss` | ~120  | `--muted-text: #6b7280`                        | `rgba(26,26,26,0.65)`                                                                  | DONE                                                           |
| `frontend/src/styles/scss/abstracts/_variables.scss` | ~140  | `--color-surface-elevated: #ffffff`            | `#fafaf8`                                                                              | DONE                                                           |
| `frontend/src/styles/scss/abstracts/_variables.scss` | ~120  | `--border-color: rgba(0,0,0,0.1)`              | `rgba(0,0,0,0.12)`                                                                     | DONE                                                           |

## 5. Card radius — unified to 20px (was 22px on web)

| File                                       | Element                                                | Old      | New    | Status |
| ------------------------------------------ | ------------------------------------------------------ | -------- | ------ | ------ |
| `frontend/src/styles/app-theme.css`        | `.app-card`, `.app-card-raised`, `.app-action-primary` | `22px`   | `20px` | DONE   |
| `backend/core/templates/emails/_base.html` | card                                                   | `16px`   | `20px` | DONE   |
| `mobile/src/theme/tokens.ts`               | `radius.card`                                          | (absent) | `20`   | DONE   |
| `brand/README.md`                          | docs                                                   | `22px`   | `20px` | DONE   |

## 6. Mobile divergence

| File                           | Issue                                                | Fix                                                                                              | Status |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| `mobile/app/welcome.tsx`       | duplicated `C` colour object lines 35–51             | use `brand.*` + `darkPalette.*` directly                                                         | DONE   |
| `mobile/src/theme/brand.ts`    | no display font                                      | add `fontDisplay: "Fraunces"`, `fontMono: "JetBrainsMono_400Regular"`                            | DONE   |
| `mobile/app/_layout.tsx`       | no font loader                                       | `useFonts` from `@expo-google-fonts/fraunces` + `@expo-google-fonts/jetbrains-mono`; gate render | DONE   |
| `mobile/package.json`          | missing font packages                                | add `expo-font`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/jetbrains-mono`              | DONE   |
| `mobile/src/theme/palettes.ts` | `errorBg` base differs from web (0.08 vs 0.10 light) | sync to `0.10` / `0.15`                                                                          | DONE   |

## 7. Fonts — Fraunces weights

Audit confirmed Fraunces is loaded with full weight range (300–700 + italic) on both `Welcome.tsx` and `MarketingPage.tsx`. No incorrect weight loads found. No action.

## 8. `--brand-font-mono` consistency

All references confirmed `JetBrains Mono`. No mismatched mono fonts. No action.

---

## Conflict notes (canonical resolution)

- **`brand/README.md` says `.app-card` radius is `22px`.** User decision: unify at `20px` (mobile canonical). README updated. Canonical going forward: **20px**.
- **`_light-mode.scss` `--accent` was not in `brand/README.md`.** Treated as stale Bootstrap remnant; removed.
- **`_variables.scss` `$success: #4caf50` conflicted with `_light-mode.scss` `--success: #2a7347`.** README requires brand green for success; the SCSS variable corrected to match.
