# TypeScript strictness (incremental migration)

The frontend `tsconfig.json` currently has `strict: false` and `noImplicitAny: false` to keep the build green while the codebase is large. The goal is to enable stricter options over time.

## Current state

- **strict**: `false`
- **noImplicitAny**: `false`
- **useUnknownInCatchVariables**: `false`

## Target state

- Enable `strict: true` (includes strictNullChecks, strictFunctionTypes, etc.).
- Enable `noImplicitAny: true`.
- Enable `useUnknownInCatchVariables: true` for safer `catch (err)` handling.

## How to migrate

1. **Option A – incremental by directory**: Create a `tsconfig.strict.json` that extends the base and sets `strict: true`, and use project references or `include` to apply it to one folder at a time (e.g. `src/services/` first), fixing errors in that folder until `tsc --noEmit` passes.
2. **Option B – fix in one pass**: Enable the options in `tsconfig.json`, run `npx tsc --noEmit`, and fix all reported errors (expect many in components that use `any` or untyped callbacks).
3. **Catch variables**: When enabling `useUnknownInCatchVariables`, type narrow in `catch` blocks, e.g. `catch (err: unknown)` then use `(err as { response?: { data?: unknown } })?.response` or `err instanceof Error`.

See the app-wide improvements plan for the original recommendation.
