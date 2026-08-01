/** @type {import("tailwindcss").Config} */
module.exports = {
  darkMode: ["class", "[data-theme='dark']"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../packages/core/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Map Tailwind font utilities to the brand stack (styles/brand.css).
        sans: [
          "var(--brand-font-primary)",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: ["var(--brand-font-display)", "Helvetica Neue", "serif"],
        serif: ["var(--brand-font-display)", "Helvetica Neue", "serif"],
        mono: [
          "var(--brand-font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        surface: {
          page: "var(--color-surface-page)",
          card: "var(--color-surface-card)",
          elevated: "var(--color-surface-elevated)",
        },
        brand: {
          primary: "var(--color-brand-primary)",
          "primary-hover": "var(--color-brand-primary-hover)",
          accent: "var(--color-accent)",
        },
        content: {
          primary: "var(--color-text-primary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
          "on-primary": "var(--color-text-on-primary)",
        },
        state: {
          success: "var(--color-state-success)",
          warning: "var(--color-state-warning)",
          error: "var(--color-state-error)",
          info: "var(--color-state-info)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
        },
      },
      ringColor: {
        focus: "var(--color-ring-focus)",
      },
      // Semantic spacing aliases on top of Tailwind's stock numeric scale, which
      // already matches the token steps (p-4=16, p-5=20, p-6=24). These resolve
      // to the generated custom properties in packages/tokens/dist/tokens.css,
      // so `p-card` cannot drift from the mobile card padding.
      spacing: {
        page: "var(--layout-screen-padding-x)",
        stack: "var(--layout-stack-gap)",
        section: "var(--layout-section-gap)",
        card: "var(--layout-card-padding)",
        "card-sm": "var(--layout-card-padding-sm)",
        "card-lg": "var(--layout-card-padding-lg)",
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
    },
  },
  plugins: [],
};
