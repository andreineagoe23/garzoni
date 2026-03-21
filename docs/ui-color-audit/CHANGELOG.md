# UI color consistency — changelog

## 2025-03-19

### Tokens

- `frontend/src/styles/scss/abstracts/_variables.scss` — semantic CSS variables (`--color-surface-*`, `--color-text-*`, `--color-brand-*`, `--color-state-*`, `--color-icon-*`, `--color-border-default`, `--color-ring-focus`, `--nav-pill-active-fg`).
- `frontend/src/styles/scss/themes/_dark-mode.scss` — dark overrides; `--color-text-on-primary` and `--color-ring-focus` align with gold accent on dark UI.

### Components

- `frontend/src/components/layout/Navbar.tsx` — active pill foreground token; burger hover/focus aligned to brand; `MonevoIcon` inherits text color.
- `frontend/src/components/dashboard/DashboardHeader.tsx` — admin mode active uses `--nav-pill-active-fg` instead of hardcoded white-only.
- `frontend/src/components/ui/GlassButton.tsx` — success variant + icon use state tokens (no raw green hex).
- `frontend/src/components/ui/GlassCard.tsx`, `GlassContainer.tsx` — surfaces/borders use semantic tokens.

### Broad cleanup

- Replaced incorrect `#2563eb` fallbacks in `var(--primary,…)` / `var(--accent,…)` across tools, billing, onboarding, exercises, feedback, legal, footer, leaderboard, profile, courses, etc. (primary → `#1d5330`, accent → `#ffd700`).
- `QuestionnaireCompletionModal.tsx` — confetti palette aligned to brand greens/gold/warning/error.
- `PortfolioAnalyzer.tsx` — chart `COLORS` aligned to brand palette.
- `frontend/src/index.css` — `body` uses `--color-surface-page` / `--color-text-primary` with legacy fallbacks.

### Docs

- `docs/ui-color-audit/route-inventory.md`
- `docs/ui-color-audit/token-usage-contract.md`
- `docs/ui-color-audit/audit-matrix.md`
- `docs/ui-color-audit/CHANGELOG.md` (this file)
