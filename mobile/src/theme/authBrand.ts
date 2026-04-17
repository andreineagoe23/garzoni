import { brand } from "./brand";

/**
 * Matches web `frontend/src/index.css` auth / marketing tokens for parity with the web app.
 * Core brand hex values come from `./brand` so we have a single source of truth.
 */
export const authBrand = {
  primary: brand.green,
  primaryPressed: "#163d26",
  accent: brand.gold,
  text: "#111827",
  textMuted: "#6b7280",
  textLabel: "#374151",
  border: "#e5e7eb",
  inputBg: "#ffffff",
  cardTint: "light" as const,
  overlay: "rgba(0,0,0,0.6)",
  error: "#dc2626",
  errorBorder: "rgba(220,38,38,0.4)",
  errorBg: "rgba(220,38,38,0.1)",
  glassFill: "rgba(255,255,255,0.88)",
  glassBorder: "rgba(255,255,255,0.45)",
} as const;
