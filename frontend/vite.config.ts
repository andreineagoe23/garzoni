/// <reference types="vitest/config" />

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { imagetools } from "vite-imagetools";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.resolve(__dirname, "../packages/core/src");

const r = (...segments: string[]) => path.resolve(__dirname, ...segments);

/** Split heavy node_modules out of the main chunk. CKEditor is not listed — it loads only via dynamic import inside lazy editor chunks. */
function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return;
  if (id.includes("lucide-react")) return "vendor-icons";
  if (id.includes("node_modules/axios") || id.includes("/axios@"))
    return "vendor-axios";
  if (id.includes("zustand")) return "vendor-state";
  if (id.includes("@tanstack/react-query")) return "vendor-query";
  if (id.includes("node_modules/three/") || id.includes("/three@"))
    return "vendor-three";
  if (id.includes("html2canvas")) return "vendor-html2canvas";
  if (id.includes("recharts")) return "vendor-charts";
  if (id.includes("framer-motion")) return "vendor-motion";
  if (id.includes("react-router")) return "vendor-react";
  if (id.includes("react-dom")) return "vendor-react";
  if (id.includes("/node_modules/react/")) return "vendor-react";
}

export default defineConfig(({ mode }) => {
  const testOnly: { find: string; replacement: string }[] =
    mode === "test"
      ? [{ find: "axios", replacement: r("src/test-utils/axios-mock.ts") }]
      : [];

  const aliases: { find: string | RegExp; replacement: string }[] = [
    ...testOnly,
    {
      find: "constants/i18n",
      replacement: path.join(coreSrc, "constants/i18n.ts"),
    },
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

  const analyze = process.env.ANALYZE === "true";

  return {
    // Expose both prefixes so Vercel can keep CRA-style REACT_APP_*; new vars can use VITE_*.
    envPrefix: ["VITE_", "REACT_APP_"],
    plugins: [
      react(),
      imagetools(),
      ...(analyze
        ? [
            visualizer({
              open: true,
              gzipSize: true,
              filename: "dist/bundle-report.html",
            }),
          ]
        : []),
    ],
    server: {
      port: 3000,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    resolve: {
      alias: aliases,
      dedupe: ["react", "react-dom"],
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
