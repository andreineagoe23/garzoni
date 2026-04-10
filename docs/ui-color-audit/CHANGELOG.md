# UI color consistency — changelog

## 2026-04-09

### Token consolidation

- `frontend/src/index.css` — removed duplicate `:root` block. Single source is now `_variables.scss` only.
- `frontend/src/styles/scss/abstracts/_variables.scss` — `--input-bg` unified to `#f3f4f6`.

### Tailwind theme wired to CSS variables

- `frontend/tailwind.config.cjs` — `theme.extend.colors` now maps `surface`, `brand`, `content`, `state`, `border` to CSS variables. Components can use `bg-surface-card`, `text-content-primary` etc. instead of verbose `bg-[color:var(...)]` chains.

### Dark mode heading overreach fixed

- `frontend/src/styles/scss/base/_typography.scss` — removed global h1–h6 `border-bottom`. Added `.section-heading` utility class for intentional use.
- `frontend/src/styles/scss/themes/_dark-mode.scss` — h1–h6 now inherit `--text-color` (#e0e0e0) by default. `.section-heading` gets gold+underline.

### Glass components simplified

- `GlassButton.tsx` — all 5 variant strings simplified from ~300 chars to ~80 using semantic Tailwind tokens.
- `GlassCard.tsx`, `GlassContainer.tsx` — simplified similarly.

### Page wrapper standardization

- `PageContainer.tsx` — uses `bg-surface-page` (semantic token).
- `Dashboard.tsx`, `CourseFlowPage.tsx`, `ExercisePage.tsx`, `Missions.tsx`, `OnboardingQuestionnaire.tsx`, `PricingFunnelDashboard.tsx`, `AuthCallback.tsx` — migrated from `bg-[color:var(--bg-color,#f8fafc)]` to `bg-surface-page`.
- ~835 instances of `text-[color:var(--text-color,...)]` / `text-[color:var(--muted-text,...)]` replaced with `text-content-primary` / `text-content-muted` across all components.

### Duplicated CSS removed

- `_dark-mode.scss` — removed ~140 lines of `.form-check`/`.option-list` duplication outside `[data-theme="dark"]`.
- `index.css` — removed ~70 lines of redundant `html[data-theme="dark"] .ck.*` selector overrides (CKEditor uses `--ck-*` CSS variables from `_dark-mode.scss` directly).

### Landing theme accent mismatch fixed

- `index.css` `.landing-theme` — removed `--accent: #e5e7eb`. Gold (`#ffd700`) now correctly applies everywhere including landing page.

### welcome.css hardcodes replaced

- All `#e6c87a`, `rgba(29,83,48,...)`, `#0b0f14` etc. replaced with CSS variables (`--gold`, `--primary-rgb`, `--landing-bg-rgb`).

### Laptop breakpoint extracted

- `_mixins.scss` — added `@mixin media-laptop` for `(min-width: 993px) and (max-width: 1366px)`.
- `_app-layout.scss`, `_grid.scss` — 17 hardcoded media queries replaced with `@include media-laptop`.

---

## 2025-03-19

### Tokens

- `_variables.scss` — semantic CSS variables (`--color-surface-*`, `--color-text-*`, `--color-brand-*`, `--color-state-*`, `--color-icon-*`, `--color-border-default`, `--color-ring-focus`, `--nav-pill-active-fg`).
- `_dark-mode.scss` — dark overrides; `--color-text-on-primary` and `--color-ring-focus` align with gold accent on dark UI.

### Components

- `Navbar.tsx` — active pill foreground token; burger hover/focus aligned to brand.
- `DashboardHeader.tsx` — admin mode active uses `--nav-pill-active-fg`.
- `GlassButton.tsx` — success variant uses state tokens.
- `GlassCard.tsx`, `GlassContainer.tsx` — surfaces/borders use semantic tokens.

### Broad cleanup

- Replaced incorrect `#2563eb` fallbacks across tools, billing, onboarding, exercises, feedback, legal, footer, leaderboard, profile, courses.
- `QuestionnaireCompletionModal.tsx` — confetti palette aligned to brand.
- `PortfolioAnalyzer.tsx` — chart colors aligned to brand palette.
