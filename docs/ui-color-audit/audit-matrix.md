# Color audit matrix (summary)

## Cross-cutting issues (pre-fix)

| Issue                            | Where             | Resolution                                                                                              |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| Wrong Tailwind fallbacks         | Many TSX files    | `var(--primary,#2563eb)` / `var(--accent,#2563eb)` replaced with `#1d5330` / `#ffd700` or semantic vars |
| Active nav `text-white` vs brand | `Navbar.tsx`      | Use `--nav-pill-active-fg` → gold on green in dark, white in light                                      |
| Burger menu blue hover/ring      | `Navbar.tsx`      | Align to `--color-ring-focus` / `--color-brand-primary`                                                 |
| Success button raw green         | `GlassButton.tsx` | Map to `--color-state-success`                                                                          |
| No single semantic layer         | SCSS              | Added `--color-*` aliases in `_variables.scss` + `_dark-mode.scss`                                      |

## Route groups (spot-check)

| Group             | Surfaces audited            | Notes                                                       |
| ----------------- | --------------------------- | ----------------------------------------------------------- |
| Shell             | Navbar, Footer              | Tokens for pills, utilities, focus                          |
| Dashboard         | `DashboardHeader`, cards    | Admin toggle uses `--nav-pill-active-fg` pattern            |
| Engagement        | Leaderboard                 | Primary/accent fallbacks corrected                          |
| Tools             | Registry tools, calculators | Focus rings + primary tints                                 |
| Billing           | Subscription plans          | Primary pill states                                         |
| Auth / onboarding | Questionnaire, modals       | Gradients use brand primary; chart palette uses brand tones |
| Legal             | `LegalPageWrapper`          | Link color fallbacks                                        |

## Dark-mode checks

- Nav active state: readable gold on green (`--color-text-on-primary`).
- Focus rings: visible on dark backgrounds (`--color-ring-focus` uses accent in dark).
- Glass surfaces: still use `--card-bg` / `--shadow-color` via semantic aliases where applied.
