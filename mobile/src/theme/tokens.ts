export const colors = {
  primary: "#01696f",
  primaryDark: "#0c4e54",
  accent: "#ffd700",
  accentMuted: "rgba(255,215,0,0.15)",
  bg: "#f7f6f2",
  surface: "#ffffff",
  surfaceOffset: "#f3f0ec",
  border: "#d4d1ca",
  text: "#28251d",
  textMuted: "#7a7974",
  textFaint: "#bab9b4",
  error: "#a12c7b",
  errorBg: "rgba(161,44,123,0.08)",
  success: "#437a22",
  successBg: "rgba(67,122,34,0.08)",
  heart: "#ef4444",
  heartEmpty: "rgba(239,68,68,0.2)",
  white: "#ffffff",
  black: "#111111",
  overlay: "rgba(0,0,0,0.45)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
} as const;
