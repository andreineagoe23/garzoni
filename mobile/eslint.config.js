// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
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
      // Keep shared deps consumed through @garzoni/core wrappers. zustand has
      // zero direct app imports (stores live in core); axios has a few direct
      // sites. Both warn so the guard flags drift without breaking CI.
      // react-query (useQuery/useMutation) is a UI hook lib and not restricted.
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "zustand",
              message:
                "Define shared stores in @garzoni/core, not directly with zustand in app code.",
            },
            {
              name: "axios",
              message:
                "Use the shared API client from @garzoni/core instead of importing axios directly.",
            },
          ],
        },
      ],
    },
  },
]);
