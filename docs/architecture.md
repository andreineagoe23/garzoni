# Architecture overview

Garzoni is a classic SPA + API setup with background jobs.

## Components

- **Frontend (React 19 + Vite)**: Static SPA served by Nginx in Docker / Vercel
- **Backend (Django REST Framework)**: JSON API + admin
- **PostgreSQL**: Primary datastore
- **Redis**: Celery broker
- **Celery worker/beat**: Background + scheduled tasks (emails, streak resets, etc.)

## Diagram

```mermaid
flowchart LR
  U[User Browser] -->|HTTP| FE[Frontend (React / Nginx / Vercel)]
  U -->|HTTP /api| BE[Backend (Django + Gunicorn)]

  FE -->|REST calls| BE
  BE -->|SQL| DB[(PostgreSQL)]
  BE -->|enqueue tasks| R[(Redis)]
  CW[Celery Worker] -->|consume tasks| R
  CW -->|SQL results| DB
  CB[Celery Beat] -->|schedule| R
```

## Tech stack

| Layer        | Tech                                                                |
| ------------ | ------------------------------------------------------------------- |
| Frontend     | React 19, TypeScript, Vite 6, Tailwind 3.4 + SCSS, React Router v7  |
| State        | Zustand (client), React Query (server), React Context (theme, auth) |
| UI system    | Custom glass morphism: GlassCard, GlassContainer, GlassButton       |
| Icons        | lucide-react, react-bootstrap-icons, react-icons/fa6                |
| Animation    | Framer Motion, Three.js (landing globe), Canvas Confetti            |
| Rich text    | CKEditor 5                                                          |
| i18n         | i18next (EN + RO)                                                   |
| Backend      | Django 4, DRF, Celery, Redis, PostgreSQL                            |
| Auth         | JWT (simplejwt) + Google OAuth                                      |
| Payments     | Stripe + RevenueCat                                                 |
| Deploy       | Vercel (frontend) + Railway (backend)                               |
| Static files | WhiteNoise; media on Cloudinary CDN                                 |

## Key directories

```
garzoni/
  frontend/src/
    components/    All React components (141+ files)
    contexts/      ThemeContext, AuthContext, AdminContext…
    hooks/         Custom hooks
    services/      API clients
    styles/scss/   SCSS design system (see docs/frontend-styling.md)
    routes/        AppShell, AppRoutes
  backend/
    core/          Main Django app
    education/     Learning path content
  docs/            Architecture and reference docs
  mobile/          Expo React Native app
```
