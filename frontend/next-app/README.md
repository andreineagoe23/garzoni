# Monevo marketing (Next.js)

This directory hosts a minimal Next.js app for marketing/onboarding pages with SSR/SSG.

## Run

```bash
npm install
npm run dev
```

## Next steps

- Move `Welcome`/`Pricing` layouts here.
- Share UI primitives from `src/components/ui`.
- Wire analytics and i18n with the main frontend.
- Use cookie-based auth (`HttpOnly` refresh token) so the marketing app can
  detect logged-in users without localStorage.
