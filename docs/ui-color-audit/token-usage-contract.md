# Semantic color tokens — usage contract

**Source of truth:** `frontend/src/styles/scss/abstracts/_variables.scss` (`:root`) and `frontend/src/styles/scss/themes/_dark-mode.scss` (`[data-theme="dark"]`).

Legacy names (`--bg-color`, `--text-color`, `--primary`, `--accent`) remain valid. Semantic aliases layer consistent meaning on top. **In Tailwind, use the semantic class names — not raw `var()` chains.**

## Tailwind class → CSS variable mapping

| Tailwind class                              | CSS variable               | Meaning                                      |
| ------------------------------------------- | -------------------------- | -------------------------------------------- |
| `bg-surface-page`                           | `--color-surface-page`     | Page / viewport background                   |
| `bg-surface-card`                           | `--color-surface-card`     | Cards, panels, modal bodies                  |
| `bg-surface-elevated`                       | `--color-surface-elevated` | Sticky headers, popovers                     |
| `text-content-primary`                      | `--color-text-primary`     | Default body text                            |
| `text-content-muted`                        | `--color-text-muted`       | Secondary labels, captions                   |
| `text-content-inverse`                      | `--color-text-inverse`     | Text on solid fills                          |
| `text-content-on-primary`                   | `--color-text-on-primary`  | Text on green (gold in dark, white in light) |
| `text-brand-primary`                        | `--color-brand-primary`    | CTAs, active states, focus                   |
| `text-brand-accent` / `text-brand-[accent]` | `--color-accent`           | Gold highlights                              |
| `text-state-success`                        | `--color-state-success`    | Success text/borders                         |
| `text-state-warning`                        | `--color-state-warning`    | Warning text                                 |
| `text-state-error`                          | `--color-state-error`      | Error text                                   |
| `text-state-info`                           | `--color-state-info`       | Info text                                    |
| `border-border`                             | `--color-border-default`   | Default dividers, card outlines              |
| `ring-focus`                                | `--color-ring-focus`       | Focus ring (green in light, gold in dark)    |

## Color values

| Purpose               | Light                                        | Dark                     |
| --------------------- | -------------------------------------------- | ------------------------ |
| Primary (brand green) | `#1d5330`                                    | `#2a6041`                |
| Accent (gold)         | `#ffd700`                                    | `#ffd700`                |
| Landing gold          | `#e6c87a` (via `--gold` on `.landing-theme`) | —                        |
| Page background       | `#f8fafc`                                    | `#121212`                |
| Card background       | `#ffffff`                                    | `#1e1e1e`                |
| Body text             | `#111827`                                    | `#e0e0e0`                |
| Muted text            | `#6b7280`                                    | `rgba(224,224,224,0.7)`  |
| Input bg              | `#f3f4f6`                                    | `rgba(0,0,0,0.25)`       |
| Border                | `rgba(0,0,0,0.1)`                            | `rgba(224,224,224,0.12)` |

## Rules

1. Prefer Tailwind semantic class names. Only use `var(--token)` directly in SCSS.
2. Do **not** hardcode `#2563eb` (blue) as fallback for primary/accent — use `#1d5330` / `#ffd700`.
3. **Gold headings:** Use `.section-heading` class or explicit `text-brand-accent` for intentional gold headings. The global dark mode rule no longer forces all h1–h6 gold.
4. **Accent semantics:** `--accent` is always gold. The landing page uses `--gold` (#e6c87a, warmer tone) for its own components.
5. **Dark mode first:** `--color-text-on-primary` is gold on green in dark mode for brand alignment; white in light mode.
6. **Welcome/landing:** Colors reference `.landing-theme` CSS variables (`--gold`, `--primary-rgb`, `--landing-bg-rgb`) — never hardcode hex.
