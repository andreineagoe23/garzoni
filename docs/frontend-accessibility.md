# Frontend accessibility checklist

Use this when adding or changing UI components so the app stays accessible.

## Automated checks

- **ESLint**: `eslint-plugin-jsx-a11y` is enabled with the recommended rule set. Run `npm run lint` in the frontend; fix or explicitly override a11y violations where necessary.
- **E2E**: Playwright tests use role-based selectors (e.g. `getByRole("button", { name: ... })`), which encourages accessible markup.

## Quick checklist for new components

1. **Forms**
   - Every form field has a visible `<label>` with `htmlFor` matching the input `id`, or use `aria-label` / `aria-labelledby` where a visible label is not desired.
   - Validation errors are associated with the field (e.g. `aria-describedby` pointing to the error message, or `aria-invalid`).

2. **Focus**
   - Interactive elements are focusable (avoid `tabIndex={-1}` unless you manage focus programmatically, e.g. modals).
   - Focus order is logical; avoid trapping focus unless in a modal/dialog.

3. **Images and media**
   - Decorative images use `alt=""`; meaningful images have a concise `alt` text.
   - Video/audio have captions or transcripts when they convey content.

4. **Keyboard**
   - All actions available with the mouse are available with the keyboard (e.g. buttons, links, custom controls).
   - Custom widgets (tabs, dropdowns, drag-and-drop) support arrow keys and Enter/Space where appropriate.

5. **Contrast and motion**
   - Text and interactive elements meet contrast requirements (WCAG 2.1 Level AA where applicable).
   - Respect `prefers-reduced-motion` for non-essential animation (the app already uses it for scroll behavior where applicable).

## References

- [jsx-a11y rules](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y#supported-rules)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
