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
    },
  },
  plugins: [],
};
