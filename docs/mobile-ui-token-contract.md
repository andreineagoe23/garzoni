# Mobile UI token contract

**Goal:** Keep the Expo app visually aligned with the web app (`frontend`) and the shared semantic rules in [token-usage-contract.md](./ui-color-audit/token-usage-contract.md).

## Source of truth

| Layer                       | Location                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime colors (light/dark) | [`mobile/src/theme/palettes.ts`](../mobile/src/theme/palettes.ts) — mirrors web SCSS tokens                                                             |
| Theme hook                  | [`mobile/src/theme/ThemeContext.tsx`](../mobile/src/theme/ThemeContext.tsx) — `useThemeColors()`, `useTheme()`                                          |
| Layout scale                | [`mobile/src/theme/tokens.ts`](../mobile/src/theme/tokens.ts) — `spacing`, `radius`, `typography`, `shadows`                                            |
| Glass surfaces              | [`mobile/src/components/ui/GlassCard.tsx`](../mobile/src/components/ui/GlassCard.tsx), [`GlassButton.tsx`](../mobile/src/components/ui/GlassButton.tsx) |

## Rules

1. **Prefer `useThemeColors()`** for any color that should follow light/dark mode. Avoid importing `colors` from `tokens.ts` except in leaf components that cannot use hooks (prefer passing colors as props from a parent that uses the hook).
2. **Page background** = `c.bg`. **Primary text** = `c.text`. **Secondary** = `c.textMuted`. **Borders** = `c.border`.
3. **Accent (gold)** = `c.accent` for highlights and section labels; do not paint every heading gold unless intentional (same as web contract).
4. **Cards:** Use `GlassCard` for grouped content on dashboard, learn, exercises, tools, settings, and billing flows. Use plain `View` + border only for dense controls (e.g. filter chips) where blur would be noisy.
5. **Spacing and type** come from `tokens.ts` — keep vertical rhythm consistent (`spacing.md`–`spacing.xl` between sections).
6. **Web-only / marketing** colors stay out of core learner screens unless documented (e.g. landing uses separate vars on web).

## Layout primitives

- **Scrollable tab body:** [`ScreenScroll`](../mobile/src/components/ui/ScreenScroll.tsx) when the screen is a full tab with bottom nav padding.
- **Stack modal / form screens:** `ScrollView` + `GlassCard` sections (see [`mobile/app/settings.tsx`](../mobile/app/settings.tsx)).

## Checklist (quick audit)

- [ ] No raw hex for brand green/gold in new screens
- [ ] Surfaces use semantic tokens (`surface`, `surfaceElevated`, `glassFill`) via `GlassCard` / theme
- [ ] Error/success use `c.error` / `c.success` (not ad-hoc reds/greens)
