/**
 * Layout tokens (spacing, radius, typography, shadows, layout).
 *
 * These now live in `@garzoni/tokens` so web and mobile cannot drift. This file
 * stays as the mobile-facing entry point — keep importing from
 * `../theme/tokens`, not from the package, so there is one place to shim if the
 * platforms ever need to diverge.
 *
 * For colours use `useTheme().colors` or `useThemeColors()` from `./ThemeContext`.
 */

export {
  spacing,
  radius,
  typography,
  layout,
  shadows,
} from "@garzoni/tokens";
