# Storybook and next-app (frontend)

## Storybook

The main frontend (CRA) has **Storybook story files** for some UI components under `frontend/src/components/ui/` (e.g. `Modal.stories.tsx`, `TextInput.stories.tsx`, `GlassButton.stories.tsx`, `GlassCard.stories.tsx`, `SelectInput.stories.tsx`). There is **no Storybook config** in the repo (no `storybook` script in `frontend/package.json` and no `.storybook/` directory).

- **To use stories:** Add Storybook (e.g. `npx storybook@latest init`) and a `npm run storybook` script, then run stories locally for development and visual review.
- **Otherwise:** Treat the existing `.stories.tsx` files as documentation or remove/relocate them if they clutter the codebase. They are not run in CI.

## next-app

The directory `frontend/next-app/` is a **separate Next.js 14 app** (e.g. “garzoni-marketing” or a landing/marketing site). It is **not** the main CRA React app that talks to the Django backend.

- **Purpose:** Typically used for a dedicated marketing or static site (e.g. Next.js SSR/SSG).
- **Deployment:** Can be deployed separately (e.g. Vercel) with its own build and env.
- **Shared code:** It does not share components or state with the main CRA app in this repo; the two are independent frontends.

If you add or change the next-app, document its deployment and any shared env (e.g. public API URL) in this file or in a README inside `frontend/next-app/`.
