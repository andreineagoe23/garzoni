/// <reference types="vitest/config" />

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.resolve(__dirname, "../packages/core/src");

const r = (...segments: string[]) => path.resolve(__dirname, ...segments);

export default defineConfig(({ mode }) => {
  const testOnly: { find: string; replacement: string }[] =
    mode === "test"
      ? [{ find: "axios", replacement: r("src/test-utils/axios-mock.ts") }]
      : [];

  const aliases: { find: string | RegExp; replacement: string }[] = [
    ...testOnly,
    { find: "constants/i18n", replacement: path.join(coreSrc, "constants/i18n.ts") },
    {
      find: "constants/skillToExerciseCategory",
      replacement: path.join(coreSrc, "constants/skillToExerciseCategory.ts"),
    },
    { find: /^constants\/(.+)$/, replacement: `${r("src/constants")}/$1` },
    { find: "App", replacement: r("src/App.tsx") },
    { find: "routes", replacement: r("src/routes") },
    { find: "bootstrap", replacement: r("src/bootstrap") },
    { find: "sentry", replacement: r("src/sentry.ts") },
    { find: "reportWebVitals", replacement: r("src/reportWebVitals.ts") },
    {
      find: "serviceWorkerRegistration",
      replacement: r("src/serviceWorkerRegistration.ts"),
    },
    { find: "contexts", replacement: r("src/contexts") },
    { find: "components", replacement: r("src/components") },
    { find: "services", replacement: path.join(coreSrc, "services") },
    { find: "utils", replacement: r("src/utils") },
    { find: "lib", replacement: r("src/lib") },
    { find: "types", replacement: path.join(coreSrc, "types") },
    { find: "assets", replacement: r("src/assets") },
    { find: "hooks", replacement: r("src/hooks") },
    { find: "stores", replacement: path.join(coreSrc, "stores") },
    { find: "styles", replacement: r("src/styles") },
    { find: "i18n", replacement: r("src/i18n.ts") },
  ];

  return {
    plugins: [react()],
    server: {
      port: 3000,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
    resolve: {
      alias: aliases,
    },
    test: {
      globals: true,
      environment: "happy-dom",
      setupFiles: ["./src/setupTests.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      pool: "forks",
      server: {
        deps: {
          inline: ["@testing-library/jest-dom"],
        },
      },
    },
  };
});
