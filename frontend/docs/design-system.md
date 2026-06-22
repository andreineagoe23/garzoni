# Garzoni frontend — design system conventions

The "use this, not that" rules for UI in `frontend/src`. Born from a consistency audit
(2026-06); the foundation (token layer + canonical `.app-*` classes + React primitives) already
exists — these rules are about **adoption**.

## Color — never hardcode

- **Never** put brand hex (`#1d5330`, `#2a7347`, `#e6c87a`) or raw Tailwind colors
  (`text-white`, `text-red-300`, `bg-red-500/15`) in component JSX.
- **Never** reach into the legacy layer from a component (`var(--primary)`, `var(--card-bg)`,
  `var(--primary-soft)`), and never use the fallback-hex anti-pattern
  (`[color:var(--primary,#1d5330)]` — the fallback is always wrong/dead since the var is defined).
- **Use** the semantic token classes / vars:
  - Surfaces: `bg-surface-page` `bg-surface-card` `bg-surface-elevated`
  - Brand/text: `text-brand-primary` `text-content-primary` `text-content-muted` `text-content-inverse`
  - State: `text-state-success` `text-state-error` (warning/info exist as `var(--color-state-*)`)
  - Border/ring: `border-border` `ring-focus`
  - Arbitrary needs: `[color:var(--color-brand-primary)]`, `var(--color-surface-card)`, etc.

The token layer is defined in `src/styles/scss/abstracts/_variables.scss` (base) +
`themes/_light-mode.scss` / `_dark-mode.scss`, mapped to Tailwind in `tailwind.config.cjs`.
The legacy `--primary`/`--card-bg`/`--primary-soft` layer still exists and the `--color-*`
tokens bridge to it — components should target the `--color-*` layer only.

## Components — canonical surface

| Need                      | Use                                                                                                              | Not                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| In-app button             | `GlassButton` (`components/ui`)                                                                                  | hand-rolled `<button className="rounded-full …">`                   |
| Full-width primary CTA    | `.app-cta-btn`                                                                                                   | ad-hoc gradient button                                              |
| Labelled field            | `TextInput` / `SelectInput` (`components/ui`); `.app-input` for custom-structure inputs (password toggle, icons) | hand-rolled `<input className="rounded-xl border …">`               |
| Card                      | `GlassCard` (or `.app-card*` in CSS-only contexts)                                                               | ad-hoc `rounded-2xl border bg-* p-*` div                            |
| Form-level error / notice | `FormNotice` (`components/common/FormNotice`)                                                                    | per-form alert `<div role="alert" className="rounded-lg border …">` |
| Badge / pill              | `.app-badge` + `.app-badge-primary` / `.app-badge-error`                                                         | inline `bg-red-500/15 text-red-400` chips                           |
| Stat tile                 | `StatBadge` / `.app-stat-tile`                                                                                   | ad-hoc tile div                                                     |

Canonical CSS classes live in `src/styles/app-theme.css`; React primitives in
`src/components/ui` and `src/components/common`.

## Done (consistency waves)

- **Token foundation**: brand hex de-duplicated in `app-theme.css`; token-bridge drift fixed;
  dead Fraunces fallback removed.
- **Legacy-var → `--color-*` migration**: 1144 refs across 81 component files moved off
  `var(--primary)`/`var(--card-bg)`/`var(--border-color)`/`var(--error)`/etc. onto the token
  layer (value-identical). Remaining holdouts: `--primary-soft` / `--primary-rgb` / `--primary-dark`
  (no `--color-*` equivalent yet) and `layout/Footer.tsx` (skipped — had unrelated local WIP).
- **Form alerts**: shared `FormNotice` across the 4 auth forms (also fixed the `/opacity`-on-var
  tint that never rendered → now `color-mix`).
- **Badges**: `.app-badge-warning` / `.app-badge-success` added (color-mix on `--color-state-*`);
  `dashboard/WeakSkills.tsx` pills moved off raw `bg-red-500/15` chips onto `.app-badge-*`.
- **Secondary-CTA pills**: resolved by the var migration — now token-based and consistently shaped.
- **Landing**: marketing/welcome unified on the shared `.mkt` design; `marketing.css` + the
  `welcome-hero` light theme now source their palette from `brand.css` tokens (value-identical).
- **Cards**: `GlassCard` already renders `.app-card`, so they are one idiom. All four auth pages
  unified on `.app-card` (Login/Register moved off an ad-hoc `rounded-2xl … bg-[#111827]` div).

## Backlog (remaining — larger / needs human review)

1. **Raw → primitive** (largest): ~190 raw `<button>`, remaining raw `<input>`/`<select>`, and 8
   ad-hoc `role="dialog"` modals (esp. `courses/CourseFlowPage.tsx`) → `GlassButton`/`TextInput`/
   `Modal`. Per-instance judgment (not every raw button maps to a primitive) — do incrementally,
   page by page, with visual QA. Not a mechanical sweep.
2. **Ad-hoc card divs → `GlassCard`/`.app-card`**: ~150 `rounded-* border bg-* p-*` divs across
   dashboard/billing/tools/courses. Same shape as #1 — per-page, visual-QA'd, not a blind sweep.
   (Auth cards already done; the canonical card is `GlassCard`.)
3. **Remaining badge spots**: `dashboard/StatusSummary.tsx` milestone badge → `.app-badge-error`.
4. **Retire the legacy `--primary`/`--card-bg`/`--primary-soft` layer** once components stop
   referencing it (after the above and the CSS internals in `app-theme.css` are migrated).

## Notes

- Sass-layer hardcoded hex that feeds `color.adjust()` / `$primary` (e.g. `_dark-mode.scss`)
  is legitimate — Sass functions can't read CSS custom properties at runtime.
- `--color-brand-primary-hover` and `--color-ring-focus` resolve to `--primary-bright` in both
  themes (the base in `_variables.scss` is kept aligned so it doesn't lie).
