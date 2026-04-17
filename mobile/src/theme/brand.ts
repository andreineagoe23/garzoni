import { Platform } from "react-native";

/**
 * Garzoni brand tokens — mirrors `frontend/src/styles/brand.css`.
 *
 * Edit the web brand tokens first (single source of truth) and keep the hex
 * values here in sync. Other mobile theme files (`palettes.ts`, `authBrand.ts`)
 * import from here so we stop duplicating literals across the codebase.
 *
 * Typography: no custom webfont is shipped. Expo picks the native Helvetica
 * equivalent per platform — `Helvetica Neue` on iOS, Android's `sans-serif`
 * (Roboto), system default elsewhere — matching the web stack
 * `"Helvetica Neue", Helvetica, Arial, sans-serif`.
 */
const fontPrimary = Platform.select({
  ios: "Helvetica Neue",
  android: "sans-serif",
  default: "System",
}) as string;

export const brand = {
  green: "#1d5330",
  greenRgb: "29, 83, 48",

  gold: "#ffd700",
  goldRgb: "255, 215, 0",
  goldWarm: "#e6c87a",
  goldWarmRgb: "230, 200, 122",

  bgDark: "#0b0f14",
  bgDarkRgb: "11, 15, 20",
  bgCard: "#111827",
  borderGlass: "rgba(255,255,255,0.12)",

  text: "#e5e7eb",
  textMuted: "rgba(229,231,235,0.72)",

  fontPrimary,
  fontMedium: fontPrimary,
  fontBold: fontPrimary,

  fontWeightRegular: "400" as const,
  fontWeightMedium: "500" as const,
  fontWeightBold: "700" as const,
} as const;

export type Brand = typeof brand;
