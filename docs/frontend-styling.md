# Frontend styling guide

The app uses **Tailwind CSS 3.4** and **SCSS** together in a hybrid system.

## When to use what

- **Tailwind** (utility classes in JSX): Component-level layout, spacing, responsive sizing, color tokens. Prefer Tailwind for new components. Use semantic color tokens (see below) — not raw hex or verbose `var()` chains.
- **SCSS** (`frontend/src/styles/scss/`): Global layout, theme infrastructure, dark mode variables, typography base, shared patterns. Entry point: `main.scss` (imported once in `index.tsx`).

## Color tokens — Tailwind aliases

Defined in `tailwind.config.cjs` and backed by CSS variables from `_variables.scss`:

| Tailwind class                          | CSS variable               | Use                                   |
| --------------------------------------- | -------------------------- | ------------------------------------- |
| `bg-surface-page`                       | `--color-surface-page`     | Page backgrounds, full-viewport wraps |
| `bg-surface-card`                       | `--color-surface-card`     | Cards, panels, modals                 |
| `bg-surface-elevated`                   | `--color-surface-elevated` | Sticky headers, popovers              |
| `text-content-primary`                  | `--color-text-primary`     | Body text, default headings           |
| `text-content-muted`                    | `--color-text-muted`       | Secondary labels, captions            |
| `text-content-inverse`                  | `--color-text-inverse`     | Text on solid fills                   |
| `text-content-on-primary`               | `--color-text-on-primary`  | Text on green primary fill            |
| `text-brand-primary`                    | `--color-brand-primary`    | CTAs, active states                   |
| `text-brand-accent`                     | `--color-accent`           | Gold highlights, emphasis             |
| `text-state-success/warning/error/info` | `--color-state-*`          | Status text                           |
| `border-border`                         | `--color-border-default`   | Dividers, card borders                |
| `ring-focus`                            | `--color-ring-focus`       | Focus rings                           |

Full semantic contract: `docs/ui-color-audit/token-usage-contract.md`

## CSS variable source of truth

**Single source:** `frontend/src/styles/scss/abstracts/_variables.scss` (`:root` block).  
Dark overrides: `frontend/src/styles/scss/themes/_dark-mode.scss` (`[data-theme="dark"]`).  
`index.css` does NOT define `:root` — only Tailwind imports, body defaults, landing theme, and scrollbar utils.

## Dark mode

Toggled via `data-theme="dark"` on `<html>`. Managed by `ThemeContext` with localStorage key `garzoni:theme`. System preference respected on first load.

## Glass component system

- `GlassCard` — cards with `rounded-3xl border-border bg-surface-card/95 backdrop-blur-lg`
- `GlassContainer` — layout containers, variants: default / subtle / strong
- `GlassButton` — 5 variants (primary, active, success, danger, ghost), 4 sizes (sm/md/lg/xl)

All use semantic Tailwind tokens — no inline `var()` chains needed.

## Page layout

Use `PageContainer` (`frontend/src/components/common/PageContainer.tsx`) for all app pages:

- Default: `maxWidth="5xl"`, `bg-surface-page`, `min-h-screen`, `px-4 py-10`
- Override widths: `7xl` (dashboard/tools), `6xl` (rewards/courses), `4xl` (exercises/quiz)

## SCSS structure

```
src/styles/scss/
  abstracts/  _variables.scss   ← design tokens (single source of truth)
              _mixins.scss      ← breakpoint helpers incl. @mixin media-laptop
  base/       _reset.scss, _typography.scss (use .section-heading not global h*)
  layout/     _app-layout.scss, _grid.scss, _header.scss, _sidebar.scss
  components/ _legal-pages.scss, _mascot-bubble.scss
  themes/     _dark-mode.scss
```

## Breakpoints

xs:0 / sm:576px / md:768px / lg:992px / xl:1200px / xxl:1400px  
Laptop range (993–1366px): use `@include media-laptop` mixin — never hardcode.

## Conventions

- Never import `main.scss` more than once (loaded in `index.tsx` only).
- Headings: do NOT rely on global heading styles. Use `.section-heading` for intentional brand underline. Apply `text-brand-accent` explicitly where gold is wanted.
- Do not add inline `var()` fallback chains in TSX — use semantic Tailwind classes instead.
