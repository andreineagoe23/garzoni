/**
 * Matches web `frontend/src/index.css` auth / marketing tokens for parity with the web app.
 */
export const authBrand = {
  primary: "#1d5330",
  primaryPressed: "#163d26",
  accent: "#ffd700",
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
