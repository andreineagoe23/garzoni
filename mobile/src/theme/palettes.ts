/**
 * Light/dark palettes aligned with web SCSS (`_variables.scss` / `_dark-mode.scss`).
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

export const lightPalette: ThemeColors = {
  primary: "#1d5330",
  primaryDark: "#0f3a22",
  accent: "#ffd700",
  accentMuted: "rgba(255, 215, 0, 0.15)",
  bg: "#f7f6f2",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  surfaceOffset: "#f3f0ec",
  border: "#d4d1ca",
  text: "#28251d",
  textMuted: "#7a7974",
  textFaint: "#bab9b4",
  textOnPrimary: "#ffffff",
  error: "#a12c7b",
  errorBg: "rgba(161, 44, 123, 0.08)",
  success: "#437a22",
  successBg: "rgba(67, 122, 34, 0.08)",
  heart: "#ef4444",
  heartEmpty: "rgba(239, 68, 68, 0.2)",
  white: "#ffffff",
  black: "#111111",
  overlay: "rgba(0,0,0,0.45)",
  glassFill: "rgba(255,255,255,0.92)",
  glassBorder: "rgba(0,0,0,0.08)",
  inputBg: "rgba(255,255,255,0.9)",
};

/** Matches web `[data-theme="dark"]` core tokens */
export const darkPalette: ThemeColors = {
  primary: "#2a6041",
  primaryDark: "#1e4832",
  accent: "#ffd700",
  accentMuted: "rgba(255, 215, 0, 0.12)",
  bg: "#121212",
  surface: "#1e1e1e",
  surfaceElevated: "#2a2a2a",
  surfaceOffset: "#252525",
  border: "rgba(224, 224, 224, 0.12)",
  text: "#e0e0e0",
  textMuted: "rgba(224, 224, 224, 0.7)",
  textFaint: "rgba(224, 224, 224, 0.45)",
  /** Light label on primary-filled controls (green button) — white reads better than gold on dark green */
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
  glassFill: "rgba(30,30,30,0.88)",
  glassBorder: "rgba(224,224,224,0.12)",
  inputBg: "rgba(0,0,0,0.25)",
};
