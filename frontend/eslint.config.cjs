// Flat config (ESLint v9). Mirrors mobile/eslint.config.js style so both apps
// stay on the same major. Replaces the legacy .eslintrc.json.
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const globals = require("globals");

// Keep shared deps consumed through @garzoni/core wrappers instead of reached
// for directly in app code. zustand has zero direct app imports today (all
// stores live in core); axios still has ~13 direct call sites. Both warn (one
// severity per rule) so the guard flags drift without breaking CI on day one.
// react-query is a UI-layer hook library (useQuery/useMutation) and is
// intentionally NOT restricted — the shared QueryClient instance lives in core.
const sharedDepGuard = {
  paths: [
    {
      name: "zustand",
      message:
        "Define shared stores in @garzoni/core, not directly with zustand in app code.",
    },
    {
      name: "axios",
      message:
        "Use the shared API client (apiClient / services from @garzoni/core) instead of importing axios directly.",
    },
  ],
};

module.exports = tseslint.config(
  {
    ignores: ["node_modules/**", "build/**", "dist/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/anchor-has-content": "warn",
      "no-restricted-imports": ["warn", sharedDepGuard],
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
