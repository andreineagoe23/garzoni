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

## Backlog (consistency follow-ups — not yet done, need visual QA)

Adoption is partial. Tracked work, each a small wave with light/dark visual QA:

1. **Badges** → replace inline color chips with `.app-badge*`; add `.app-badge-warning` /
   `.app-badge-success` (mirroring `.app-badge-error`, using `--color-state-*`). First targets:
   `dashboard/WeakSkills.tsx` (`PILL_CLASS`), `dashboard/StatusSummary.tsx`.
2. **Secondary-CTA pills** → one canonical pill (`.app-pill` or `GlassButton size="sm"`).
   Divergent today: `dashboard/StatusSummary.tsx` ("Start Reviews"), `tools/WhyThisMatters.tsx`.
3. **Raw → primitive**: ~190 raw `<button>`, the remaining raw `<input>`/`<select>`, and 8 ad-hoc
   `role="dialog"` modals (esp. `courses/CourseFlowPage.tsx`) → `GlassButton`/`TextInput`/`Modal`.
4. **Legacy-var usage in components** (~15-20 files: `tools/ToolSignalStrip`, `layout/Navbar`+
   `Header`, `billing/*`, `dashboard/*`) reaching into `var(--card-bg)`/`var(--primary-soft)` →
   `--color-*` tokens / Tailwind classes.
5. **Landing CSS** (`components/landing/welcome.css`, `marketing.css`) — self-contained
   `.landing-theme` micro-system with its own var namespace and two `.landing-theme`
   definitions (index.css:80 + marketing.css:1); de-dupe its hardcoded hex against its own
   local vars, and reconcile the duplicate definitions. Deferred from the first pass (regression risk).
6. **Card idiom collapse**: GlassCard vs `.app-card` vs ad-hoc divs → one idiom.
7. **Retire the legacy `--primary`/`--card-bg` layer** once components stop referencing it.

## Notes

- Sass-layer hardcoded hex that feeds `color.adjust()` / `$primary` (e.g. `_dark-mode.scss`)
  is legitimate — Sass functions can't read CSS custom properties at runtime.
- `--color-brand-primary-hover` and `--color-ring-focus` resolve to `--primary-bright` in both
  themes (the base in `_variables.scss` is kept aligned so it doesn't lie).
