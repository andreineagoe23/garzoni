/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REACT_APP_RECAPTCHA_SITE_KEY?: string;
  readonly REACT_APP_SENTRY_DSN?: string;
  readonly REACT_APP_BACKEND_URL?: string;
  readonly VITE_ENABLE_LOGS?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_CHECKOUT_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_BACKEND_PORT?: string;
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  readonly VITE_AMPLITUDE_API_KEY?: string;
  /** Cloudinary cloud name for `@monevo/core` `Images` (auth/landing URLs). */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
