/**
 * Emits `dist/tokens.css` from `src/index.ts` so the web app consumes exactly
 * the same numbers the mobile app does.
 *
 * Run: `pnpm -F @garzoni/tokens build:css` (also runs on the web app's `predev`
 * and `prebuild`). Commit the output — the diff is the audit trail.
 *
 * Node strips the TypeScript types natively (Node >= 22.18), so there is no
 * build tool in this path on purpose. That is also why the repo pins Node via
 * `.nvmrc` — on older Node this import fails with ERR_UNKNOWN_FILE_EXTENSION.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_NODE = [22, 18];
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  console.error(
    `@garzoni/tokens: Node ${MIN_NODE.join(".")}+ is required (running ${process.versions.node}).\n` +
      "This script imports src/index.ts directly and needs Node's native TypeScript\n" +
      "stripping. Use the version in .nvmrc (`nvm use`)."
  );
  process.exit(1);
}

// Dynamic so the version guard above can report a readable error first — a
// static import of a .ts file throws before any of this module's code runs.
const { layout, radius, spacing, typography } = await import(
  "../src/index.ts"
);

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
