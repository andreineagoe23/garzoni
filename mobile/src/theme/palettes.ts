import { brand } from "./brand";

/**
 * Light/dark palettes aligned with web SCSS (`_variables.scss` / `_dark-mode.scss`).
 * Core brand hex values come from `./brand` (single source of truth).
 */
export type ThemeColors = {
  primary: string;
  primaryDark: string;
  accent: string;
  accentMuted: string;
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceOffset: string;
  border: string;
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

/** Web `:root` in-app theme */
export const lightPalette: ThemeColors = {
  primary: brand.green,
  primaryDark: "#0f3a22",
  accent: brand.gold,
  accentMuted: `rgba(${brand.goldRgb}, 0.15)`,
  bg: "#f8fafc",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  surfaceOffset: "#f3f4f6",
  border: "rgba(0, 0, 0, 0.1)",
  text: "#111827",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",
  textOnPrimary: "#ffffff",
  error: "#dc2626",
  errorBg: "rgba(220, 38, 38, 0.08)",
  success: "#437a22",
  successBg: "rgba(67, 122, 34, 0.08)",
  heart: "#ef4444",
  heartEmpty: "rgba(239, 68, 68, 0.2)",
  white: "#ffffff",
  black: "#111111",
  overlay: "rgba(0,0,0,0.45)",
  glassFill: "rgba(255,255,255,0.92)",
  glassBorder: "rgba(0,0,0,0.08)",
  inputBg: "#f3f4f6",
};

/** Web `[data-theme="dark"]` in-app theme (neutral grey, not brand slate) */
export const darkPalette: ThemeColors = {
  primary: "#2a6041",
  primaryDark: "#143d22",
  accent: brand.gold,
  accentMuted: `rgba(${brand.goldRgb}, 0.12)`,
  bg: "#121212",
  surface: "#1e1e1e",
  surfaceElevated: "#2a2a2a",
  surfaceOffset: "#171717",
  border: "rgba(224, 224, 224, 0.12)",
  text: "#e0e0e0",
  textMuted: "rgba(224, 224, 224, 0.7)",
  textFaint: "rgba(224, 224, 224, 0.45)",
  textOnPrimary: "#ffffff",
  error: "#d32f2f",
  errorBg: "rgba(211, 47, 47, 0.12)",
  success: "#2e7d32",
  successBg: "rgba(46, 125, 50, 0.12)",
  heart: "#ef4444",
  heartEmpty: "rgba(239, 68, 68, 0.25)",
  white: "#ffffff",
  black: "#000000",
  overlay: "rgba(0,0,0,0.65)",
  glassFill: "rgba(30,30,30,0.82)",
  glassBorder: "rgba(224, 224, 224, 0.12)",
  inputBg: "rgba(0,0,0,0.25)",
};
