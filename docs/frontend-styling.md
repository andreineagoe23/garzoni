# Frontend styling (Tailwind + SCSS)

The app uses **Tailwind CSS** and **SCSS** together. To keep styles consistent and avoid overlap:

## When to use what

- **Tailwind** (utility classes in JSX): Use for **component-level** layout and one-off styling (e.g. `flex`, `gap-4`, `rounded-xl`, `text-primary`, responsive breakpoints). Prefer Tailwind for new components and small tweaks.
- **SCSS** (in `frontend/src/styles/scss/`): Use for **global layout, theme, and shared patterns** (e.g. app layout, sidebar, header, dark mode variables, typography base, legal-page overrides). The main entry is `main.scss`, imported once in `frontend/src/index.tsx`.

## Conventions

- Do not import `main.scss` in more than one place (it is loaded in `index.tsx` only).
- For new global or layout-level rules, add them to the appropriate SCSS partial under `frontend/src/styles/scss/` (e.g. `_dark-mode.scss`, `layout/`, `base/`).
- For component-specific styles that are too verbose as Tailwind classes, consider a small SCSS module or keep using Tailwind with `className`.
