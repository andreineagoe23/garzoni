// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // RN Text commonly contains apostrophes/quotes; stricter escaping is noisy for this codebase.
      "react/no-unescaped-entities": "off",
    },
  },
]);
