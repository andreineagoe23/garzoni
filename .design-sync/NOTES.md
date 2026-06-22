# design-sync notes — Garzoni Design System

## What is synced
- Source is the **app** `@garzoni/web` (frontend/), NOT a component library. Scope = the
  6 primitives in `frontend/src/components/ui/` (GlassButton, GlassCard, GlassContainer,
  TextInput, SelectInput, Modal — the exports in `ui/index.ts`).
- `icons.tsx` / `garzoniIcons.tsx` are NOT exported from `ui/index.ts` → not synced.
- No library dist; the bundle is built via `--entry frontend/src/components/ui/index.ts`.

## Build invariants
- `frontend/.storybook/` exists but has **zero stories** → shape forced to `package`
  (`cfg.shape`), not storybook.
- Build cmd (must run first, produces `frontend/dist/`): `pnpm -F @garzoni/web build`.
- `--node-modules frontend/node_modules` (react 19 resolves there).
- Converter run from repo root:
  `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules frontend/node_modules --entry frontend/src/components/ui/index.ts --out ./ds-bundle`

## Styling
- Components use custom Tailwind theme classes (`bg-surface-card`, `text-brand-primary`,
  `text-state-error`, …) → CSS vars in `frontend/src/styles/brand.css` + `app-theme.css`.
- `cfg.cssEntry = frontend/dist/assets/index-<hash>.css` — the compiled **app** CSS
  (Tailwind utilities + `:root` token defs). Tailwind purges but its content glob covers
  `src/**` so the ui classes are present.
- **dtsPropsFor** hand-written for all 6: source props are non-exported `type` aliases with
  `React.*HTMLAttributes` intersections; ts-morph emitted `[key:string]:unknown` stubs.
  Keep the bodies in sync with the component sources.
- Previews wrap content in `data-theme="dark"` + bg `#0b0f14` (the app's `--brand-bg-dark`):
  TextInput/SelectInput/Modal hardcode white text (`text-white/90`, `bg-white/5`), invisible
  on the floor card's white bg. The wrapper makes dark-theme token values apply.
- `Modal` portals to `document.body` (`createPortal`, `fixed inset-0`) →
  `cfg.overrides.Modal.cardMode=single`, `primaryStory=Open`, `viewport=640x420`.

## Fonts
- Inter + JetBrains Mono are served at runtime from Google Fonts (`<link>` in `index.html`).
- Shipped via `cfg.extraFonts = ../.design-sync/assets/fonts.css` — 40 `@font-face` rules
  with **remote gstatic woff2 src** (fetched from fonts.googleapis.com css2). Fonts load from
  the gstatic CDN at render time, same as the real app. Needs render-env internet egress.

## Known render warns (triaged — do not chase)
- `[FONT_MISSING] "source-code-pro"` — accepted. Generic monospace **fallback** name in
  `src/index.css`'s mono stack (`source-code-pro, Menlo, Monaco, …`), not a real brand font.
  System mono renders fine.

## Re-sync risks
- **cssEntry hashed filename rots**: `dist/assets/index-*.css` changes on every `vite build`.
  If a re-sync warns `[CSS_PLACEHOLDER]`/missing, update `cfg.cssEntry` to the new
  `dist/assets/index-*.css` (largest one). Requires `pnpm -F @garzoni/web build` first.
- **Remote fonts can 404 silently**: `fonts.css` pins gstatic woff2 URLs at a font version
  (currently Inter v20). If Google rotates them, `@font-face` src 404s and previews fall back
  to system fonts with no error. Re-fetch the css2 from fonts.googleapis.com if fonts look off.
- **dtsPropsFor + authored previews are hand-tied to current APIs** (variant/size/padding
  enums, prop names). If `ui/*.tsx` props change, update both `cfg.dtsPropsFor` and
  `.design-sync/previews/*.tsx`.
