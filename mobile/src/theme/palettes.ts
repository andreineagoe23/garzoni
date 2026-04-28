import { brand } from "./brand";

/**
 * Light/dark palettes aligned with web SCSS (`_light-mode.scss` / `_dark-mode.scss`).
 * Core brand hex values come from `./brand` (single source of truth).
 */
export type ThemeColors = {
  primary: string;
  primaryBright: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  accentMuted: string;
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceOffset: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textFaint: string;
  textOnPrimary: string;
  error: string;
  errorBg: string;
  success: string;
  successBg: string;
  heart: string;
  heartEmpty: string;
  white: string;
  black: string;
  overlay: string;
  /** Glass card fill (semi-transparent) */
  glassFill: string;
  glassBorder: string;
  inputBg: string;
};

/** Web `:root` light theme — cream/ivory palette */
export const lightPalette: ThemeColors = {
  primary: brand.green,
  primaryBright: brand.greenBright,
  primaryDark: "#0f3a22",
  primarySoft: brand.greenSoftLight,
  accent: brand.gold,
  accentMuted: `rgba(${brand.goldRgb}, 0.15)`,
  bg: "#f5f5f0", // cream — was #f8fafc
  surface: "#ffffff",
  surfaceElevated: "#fafaf8", // was #ffffff
  surfaceOffset: "#eae9e4", // deeper cream — was #f3f4f6
  border: "rgba(0, 0, 0, 0.12)", // was 0.1
  borderSoft: "rgba(0, 0, 0, 0.06)",
  text: "#1a1a1a", // was #111827
  textMuted: "rgba(26, 26, 26, 0.65)", // was #6b7280
  textFaint: "rgba(26, 26, 26, 0.40)", // was #9ca3af
  textOnPrimary: "#ffffff",
  error: "#dc2626",
  errorBg: "rgba(220, 38, 38, 0.08)",
  success: brand.greenBright, // was #437a22
  successBg: "rgba(42, 115, 71, 0.10)", // was wrong green rgb
  heart: "#ef4444",
  heartEmpty: "rgba(239, 68, 68, 0.2)",
  white: "#ffffff",
  black: "#111111",
  overlay: "rgba(0,0,0,0.45)",
  glassFill: "rgba(255,255,255,0.92)",
  glassBorder: "rgba(0, 0, 0, 0.06)", // was 0.08
  inputBg: "#ffffff", // was #f3f4f6 — white inputs on cream
};

/** Web `[data-theme="dark"]` — brand slate palette */
export const darkPalette: ThemeColors = {
  primary: brand.green, // was "#2a6041" — WRONG
  primaryBright: brand.greenBright,
  primaryDark: "#0f3a22",
  primarySoft: brand.greenSoft,
  accent: brand.gold,
  accentMuted: `rgba(${brand.goldRgb}, 0.12)`,
  bg: brand.bgDark, // was "#121212" — WRONG
  surface: brand.bgCard, // was "#1e1e1e" — WRONG
  surfaceElevated: "#161f2e", // was "#2a2a2a"
  surfaceOffset: brand.bgDeep, // was "#171717"
  border: brand.borderGlass, // was "rgba(224,224,224,0.12)" — WRONG
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text, // was "#e0e0e0"
  textMuted: brand.textMuted, // was "rgba(224,224,224,0.7)"
  textFaint: "rgba(229,231,235,0.40)", // was "rgba(224,224,224,0.45)"
  textOnPrimary: "#ffffff",
  error: "#dc2626",
  errorBg: "rgba(220, 38, 38, 0.12)",
  success: brand.greenBright, // was "#2e7d32"
  successBg: "rgba(42, 115, 71, 0.15)", // was wrong green
  heart: "#ef4444",
  heartEmpty: "rgba(239, 68, 68, 0.25)",
  white: "#ffffff",
  black: "#000000",
  overlay: "rgba(0,0,0,0.65)",
  glassFill: "rgba(17, 24, 39, 0.85)", // adjusted for new #111827 surface
  glassBorder: brand.borderGlass, // was "rgba(224,224,224,0.12)" — WRONG
  inputBg: "rgba(255,255,255,0.05)", // was "rgba(0,0,0,0.25)"
};
