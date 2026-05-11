import { Platform } from "react-native";

/**
 * Garzoni brand tokens — mirrors `brand/kit/tokens.css` (single source of truth).
 *
 * Body font: native Helvetica equivalent per platform (`Helvetica Neue` on iOS,
 * `sans-serif`/Roboto on Android) — matches web stack.
 * Display font: `Fraunces_400Regular` — loaded via `expo-font` in `app/_layout.tsx`
 * (see `@expo-google-fonts/fraunces`). Falls back to system serif if load fails.
 * Mono font: `JetBrainsMono_400Regular` — same loader.
 */
const fontPrimary = Platform.select({
  ios: "Helvetica Neue",
  android: "sans-serif",
  default: "System",
}) as string;

export const brand = {
  green: "#1d5330",
  greenRgb: "29, 83, 48",
  greenBright: "#2a7347",
  greenSoft: "rgba(29, 83, 48, 0.18)", // dark mode badge tint
  greenSoftLight: "rgba(29, 83, 48, 0.10)", // light mode badge tint

  gold: "#ffd700",
  goldRgb: "255, 215, 0",
  goldWarm: "#e6c87a",
  goldWarmRgb: "230, 200, 122",

  bgDark: "#0b0f14",
  bgDarkRgb: "11, 15, 20",
  bgDeep: "#070a0e",
  bgCard: "#111827",
  borderGlass: "rgba(255,255,255,0.12)",

  text: "#e5e7eb",
  textMuted: "rgba(229,231,235,0.72)",

  fontPrimary,
  fontMedium: fontPrimary,
  fontBold: fontPrimary,
  /** Display serif — h1/h2/h3 + editorial italics. Loaded via expo-font in app/_layout.tsx. */
  fontDisplay: "Fraunces_400Regular",
  fontDisplayItalic: "Fraunces_400Regular_Italic",
  /** Mono — stats, prices, percentages, code. Loaded via expo-font in app/_layout.tsx. */
  fontMono: "JetBrainsMono_400Regular",

  fontWeightRegular: "400" as const,
  fontWeightMedium: "500" as const,
  fontWeightBold: "700" as const,
} as const;

export type Brand = typeof brand;
