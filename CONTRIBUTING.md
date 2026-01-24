# Contributing

## Repo layout

- `frontend/`: React SPA (authenticated app)
- `frontend/next-app/`: Next.js marketing/SSR app (public pages)
- `backend/`: Django API

## TypeScript

- We use `tsconfig.json` in `frontend/` with strict mode enabled.
- Prefer `types/api.ts` for shared API response shapes.
- Convert new components to `.tsx` and add explicit prop types.

## i18n

- `frontend/src/i18n.ts` defines namespaces (`common`, `dashboard`, `landing`, `auth`, `billing`, `tools`, `profile`).
- Translation files live in `frontend/src/locales/<lang>/`.
- Add new strings to the relevant namespace and use `useTranslation("<ns>")`.
- Use `utils/format.ts` for locale-aware numbers, dates, and currency.
- Prefer translation tables for backend enum labels (e.g., plan names, feature keys).
- Persisted language is stored in `localStorage` under `monevo:lang`.

## Storybook

- Stories live next to components in `frontend/src/components`.
- Run `npm run storybook` from `frontend/`.
- Include accessibility notes in story descriptions where relevant.

## Quality gates

- Husky runs `npm run lint` and `npm run format:check` on pre-commit.
- Keep logs behind `REACT_APP_ENABLE_LOGS` or remove before release.

## Marketing ↔ App integration

- Auth is cookie-based where possible; avoid localStorage for shared sessions.
- Theme and i18n preferences should be stored in cookies or localStorage with
  shared keys (`monevo:theme`, `monevo:lang`).
- Shared UI primitives should live under `frontend/src/components/ui` and can
  be copied or packaged for Next.js.

## Running locally

```bash
cd frontend
npm install
npm start
```

```bash
cd frontend/next-app
npm install
npm run dev
```

## Tests

- Unit tests: `npm test -- --watchAll=false` (from `frontend/`).
- E2E smoke tests: `npx playwright test` (from `frontend/`).
- Formatting helpers: see `frontend/src/utils/format.test.ts` for locale examples.
- When adding new locales, ensure `format.test.ts` covers number, currency, date, and time formatting.

## Formatting

- Always use `utils/format.ts` helpers (`formatCurrency`, `formatDate`, `formatNumber`, `formatPercentage`) instead of `toLocaleString` or manual formatting.
- Formatting functions automatically derive locale from i18n language.
- For dynamic backend content (e.g., plan names, error messages), use translation tables in namespace JSON files.
- Test formatting in both English and Spanish locales.
