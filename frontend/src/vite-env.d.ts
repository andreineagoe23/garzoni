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
  /** Cloudinary cloud name for `@garzoni/core` `Images`, `mascotImageUrl`, etc. */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  /**
   * RevenueCat Web SDK public API key.
   * test_* = sandbox mode (no real charges). Replace with live key for production.
   * Get from: RevenueCat Dashboard → Project → API Keys → Public app-specific keys.
   */
  readonly VITE_REVENUECAT_API_KEY?: string;
  /**
   * App Store Connect provider token (`pt`), public — it appears in every campaign
   * link. Without it store badges still carry `ct` but Apple won't attribute them.
   * Get from: App Store Connect → App Analytics → Sources → Campaigns → Generate a link.
   */
  readonly VITE_APPLE_PROVIDER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
