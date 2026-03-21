# Semantic color tokens — usage contract

**Source of truth:** `frontend/src/styles/scss/abstracts/_variables.scss` (`:root`) and `frontend/src/styles/scss/themes/_dark-mode.scss` (`[data-theme="dark"]`). Legacy names (`--bg-color`, `--text-color`, `--primary`, `--accent`, …) remain supported; semantic aliases layer consistent meaning.

## Surfaces

| Token | Meaning | Use | Avoid |
|-------|---------|-----|-------|
| `--color-surface-page` | App background | Page wrappers, full-viewport backgrounds | Text directly on this without `--color-text-*` |
| `--color-surface-card` | Default panel / card | `GlassCard`, cards, modals body | Replacing `--card-bg` ad-hoc |
| `--color-surface-elevated` | Slightly lifted surface (optional) | Sticky headers, popovers | Large fields of flat color without border |

## Text

| Token | Meaning | Use | Avoid |
|-------|---------|-----|-------|
| `--color-text-primary` | Main body / titles (non-accent) | Paragraphs, default headings in app chrome | Decorative gold overload |
| `--color-text-muted` | Secondary labels, helper text | Captions, meta | Primary actions |
| `--color-text-inverse` | Text on strong fills (e.g. errors) | Alerts, solid danger buttons | Default paragraphs |
| `--color-text-on-primary` | Text/icons on **primary** (green) fills | Active nav pill, primary CTA label on green | Surfaces that are not primary |

## Brand & accent

| Token | Meaning | Use | Avoid |
|-------|---------|-----|-------|
| `--color-brand-primary` | Brand green | CTAs, active states, focus affordances | Paragraph text |
| `--color-accent` | Gold highlight | Titles (per theme), links in dark theme, emphasis | Every icon and label |

## State

| Token | Use |
|-------|-----|
| `--color-state-success` | Success text, borders, success buttons |
| `--color-state-warning` | Warnings |
| `--color-state-error` | Errors, destructive emphasis |
| `--color-state-info` | Informational (non-success) |

## Icons

| Token | Use |
|-------|-----|
| `--color-icon-default` | Icons that match primary text |
| `--color-icon-muted` | Toolbar / secondary icons |
| `--color-icon-on-brand` | Icons on primary buttons (often matches `--color-text-on-primary`) |

## Border & focus

| Token | Use |
|-------|-----|
| `--color-border-default` | Default dividers and outlines |
| `--color-ring-focus` | Focus ring color (pair with opacity in Tailwind) |
| `--nav-pill-active-fg` | Active nav pill label/icon on primary background |

## Rules

1. Prefer `var(--token)` (with a correct hex fallback only when required for Tailwind arbitrary values).
2. Do **not** use generic blue (`#2563eb`) as a fallback for `--primary` / `--accent`.
3. **Dark mode first:** `--color-text-on-primary` is **gold** on green in dark mode for brand alignment; light mode stays **white** for contrast.
4. **Accent:** reserve gold for headings (global theme), links, and highlights—not every interactive icon.
