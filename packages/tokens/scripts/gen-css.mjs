/**
 * Emits `dist/tokens.css` from `src/index.ts` so the web app consumes exactly
 * the same numbers the mobile app does.
 *
 * Run: `pnpm -F @garzoni/tokens build:css` (also runs on the web app's `predev`
 * and `prebuild`). Commit the output — the diff is the audit trail.
 *
 * Node strips the TypeScript types natively (Node >= 22.18), so there is no
 * build tool in this path on purpose.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { layout, radius, spacing, typography } from "../src/index.ts";

const here = dirname(fileURLToPath(import.meta.url));
// Not `dist/` — the repo .gitignore excludes that, and this output is meant to
// be committed so token changes show up in review as a CSS diff.
const outFile = join(here, "..", "tokens.css");

const px = (n) => `${n}px`;

const lines = [
  "/*",
  " * GENERATED FILE — do not edit.",
  " * Source: packages/tokens/src/index.ts",
  " * Regenerate: pnpm -F @garzoni/tokens build:css",
  " */",
  ":root {",
  "  /* Spacing scale */",
  ...Object.entries(spacing).map(([k, v]) => `  --space-${k}: ${px(v)};`),
  "",
  "  /* Semantic layout */",
  ...Object.entries(layout).map(
    ([k, v]) => `  --layout-${kebab(k)}: ${px(v)};`
  ),
  "",
  "  /* Radii */",
  ...Object.entries(radius).map(([k, v]) => `  --radius-${k}: ${px(v)};`),
  "",
  "  /* Type scale */",
  ...Object.entries(typography).map(([k, v]) => `  --font-size-${k}: ${px(v)};`),
  "}",
  "",
];

function kebab(s) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(`wrote ${outFile}`);
