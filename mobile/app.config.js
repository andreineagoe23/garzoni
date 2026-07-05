/** @type {import('expo/config').ExpoConfig} */

/**
 * EAS: after creating a new Expo project (old one deleted), run once from `mobile/`:
 *   pnpm exec eas init
 * That writes `extra.eas.projectId` into app.json. Slug in app.json should match the new project (e.g. garzoni).
 */

/**
 * Google Sign-In iOS plugin needs REVERSED_CLIENT_ID as URL scheme, e.g.
 * `com.googleusercontent.apps.123456789-abc` from client id `123456789-abc.apps.googleusercontent.com`.
 */
function normalizeGoogleIosClientId(raw) {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.includes(".apps.googleusercontent.com")) return t;
  if (/^\d+-[a-zA-Z0-9]+$/.test(t)) return `${t}.apps.googleusercontent.com`;
  return t;
}

function googleIosReversedUrlScheme(iosClientId) {
  const t = normalizeGoogleIosClientId(iosClientId);
  if (!t) return "";
  const m = t.match(/^(\d+-[a-zA-Z0-9]+)\.apps\.googleusercontent\.com$/);
  if (m) return `com.googleusercontent.apps.${m[1]}`;
  return "";
}

const normalizedGoogleIosClientId = normalizeGoogleIosClientId(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
);

const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() ||
  googleIosReversedUrlScheme(normalizedGoogleIosClientId);

/**
 * Always register the Google Sign-In config plugin so Android manifest entries
 * are emitted (Android matches the OAuth client by package + SHA-1, no
 * iosUrlScheme needed). On iOS the URL scheme is still required for the
 * REVERSED_CLIENT_ID URL type; pass it only when known.
 */
const googleSignInPlugin = googleIosUrlScheme
  ? [
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: googleIosUrlScheme },
    ]
  : ["@react-native-google-signin/google-signin"];

if (
  !googleIosUrlScheme &&
  process.env.EAS_BUILD === "true" &&
  process.env.EAS_BUILD_PLATFORM === "ios"
) {
  // eslint-disable-next-line no-console
  console.warn(
    "[app.config] Google Sign-In iOS URL scheme missing. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or " +
      "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME in EAS project secrets (or eas.json env) to enable native Google login on iOS.",
  );
}

/**
 * Sentry project: iOS history lives in `apple-ios`, Android gets its own
 * project so historical issue grouping isn't broken. Override via SENTRY_PROJECT
 * env if you want one project for both.
 */
function resolveSentryProject() {
  if (process.env.SENTRY_PROJECT) return process.env.SENTRY_PROJECT;
  if (process.env.EAS_BUILD_PLATFORM === "android") {
    return process.env.SENTRY_PROJECT_ANDROID ?? "garzoni-android";
  }
  return "apple-ios";
}

/**
 * Runtime crash-reporting DSN. iOS and Android use separate Sentry projects
 * (apple-ios / garzoni-android), so each platform build must embed the DSN of
 * its own project — otherwise events land in the wrong project and uploaded
 * sourcemaps can't symbolicate them. Each EAS build is single-platform, so we
 * pick by EAS_BUILD_PLATFORM. Falls back to the shared DSN for local/dev.
 */
function resolveSentryDsn() {
  const shared = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (process.env.EAS_BUILD_PLATFORM === "android") {
    return process.env.EXPO_PUBLIC_SENTRY_DSN_ANDROID?.trim() || shared;
  }
  return process.env.EXPO_PUBLIC_SENTRY_DSN_IOS?.trim() || shared;
}

function preferHttpsForRailway(url) {
  const t = (url || "").trim();
  try {
    const u = new URL(t);
    if (u.protocol === "http:" && /\.railway\.app$/i.test(u.hostname)) {
      u.protocol = "https:";
      return u.href.replace(/\/+$/, "");
    }
  } catch {
    /* ignore */
  }
  return t;
}

/** Dev / preview: allow http:// to Docker on LAN (iOS ATS + Android cleartext). Production builds should omit this. */
const allowInsecureLocalHttp =
  process.env.EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_HTTP === "1";

const isProductionBuildProfile = process.env.EAS_BUILD_PROFILE === "production";

module.exports = ({ config }) => ({
  ...config,
  updates: {
    ...(config.updates ?? {}),
    ...(process.env.EXPO_UPDATES_CODE_SIGNING_CERTIFICATE
      ? {
          codeSigningCertificate:
            process.env.EXPO_UPDATES_CODE_SIGNING_CERTIFICATE,
          codeSigningMetadata: {
            keyid: process.env.EXPO_UPDATES_CODE_SIGNING_KEY_ID || "main",
            alg: "rsa-v1_5-sha256",
          },
        }
      : {}),
  },
  ios: {
    ...config.ios,
    associatedDomains: ["applinks:garzoni.app", "applinks:www.garzoni.app"],
    entitlements: {
      ...(config.ios?.entitlements ?? {}),
      "com.apple.developer.applesignin": ["Default"],
      "aps-environment": "production",
    },
    infoPlist: {
      ...config.ios?.infoPlist,
      NSPhotoLibraryUsageDescription:
        "Allow Garzoni to choose a profile photo from your library (shown on this device until you update your avatar in account settings).",
      NSUserNotificationsUsageDescription:
        "Garzoni sends notifications to remind you of daily learning goals, streak milestones, and mission completions.",
      NSCameraUsageDescription:
        "Garzoni uses the camera to scan receipts and statements for AI-powered spending insights (Pro feature).",
      NSMicrophoneUsageDescription:
        "Garzoni uses the microphone for the voice tutor so you can ask finance questions hands-free (Pro feature).",
      UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
      "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
      ...(allowInsecureLocalHttp
        ? {
            NSAppTransportSecurity: {
              ...(typeof config.ios?.infoPlist?.NSAppTransportSecurity ===
                "object" && config.ios.infoPlist.NSAppTransportSecurity !== null
                ? config.ios.infoPlist.NSAppTransportSecurity
                : {}),
              NSAllowsLocalNetworking: true,
            },
          }
        : {}),
    },
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
  },
  extra: {
    ...(config.extra ?? {}),
    /** `development` | `production` — used for native policy and optional runtime checks. */
    appEnv: process.env.EXPO_PUBLIC_APP_ENV?.trim() || undefined,
    /** Platform-resolved Sentry DSN (iOS → apple-ios, Android → garzoni-android). */
    sentryDsn: resolveSentryDsn() || undefined,
    /** Railway / Django API origin (no trailing slash). `/api` is added automatically in the client. */
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || undefined,
    /** Base URL of the web app (for Tools / Legal WebViews), e.g. https://app.example.com */
    webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL?.trim() || undefined,
    cloudinaryCloudName:
      process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || undefined,
    /** Same as backend GOOGLE_OAUTH_CLIENT_ID (Web application client in Google Cloud). */
    googleWebClientId:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined,
    /** iOS OAuth client ID from Google Cloud (type: iOS). */
    googleIosClientId: normalizedGoogleIosClientId || undefined,
    /** RevenueCat iOS API key (public key from RevenueCat dashboard → API keys). */
    revenueCatApiKeyIos:
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || undefined,
    /** RevenueCat Android API key (public key from RevenueCat dashboard → API keys). */
    revenueCatApiKeyAndroid:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim() || undefined,
    /** Optional RevenueCat Targeting placement id for the in-app paywall offering. */
    revenueCatPaywallPlacement:
      process.env.EXPO_PUBLIC_REVENUECAT_PAYWALL_PLACEMENT?.trim() || undefined,
  },
  plugins: [
    ...(Array.isArray(config.plugins) ? config.plugins : []),
    // Strip the portrait/orientation lock off the transitive ML Kit barcode
    // activity so Android 16 large-screen devices aren't flagged by Play.
    "./plugins/withLargeScreenSupport",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        // Source-map upload during EAS builds. Override via env if you split iOS/Android projects later.
        // Do not use `sentry-wizard -i ios` here — Expo uses @sentry/react-native (see sentryMobile.ts).
        organization: process.env.SENTRY_ORG ?? "garzoni",
        project: resolveSentryProject(),
      },
    ],
    [
      "expo-splash-screen",
      {
        // The legacy top-level `splash` key is ignored by SDK 54 prebuild on
        // Android 12+ (theme got no windowSplashScreenAnimatedIcon), so the OS
        // fell back to the launcher icon cropped by the circular mask — the
        // "zoomed logo" splash. This plugin generates the proper v31 styles.
        backgroundColor: "#0b0f14",
        image: "./assets/garzoni-logo-square-no-bg.png",
        resizeMode: "contain",
        android: {
          // Android 12+ masks the splash icon to a circle (safe zone ≈160dp
          // diameter). The wordmark is wide (1080×312 px in a 1200px square),
          // so cap it at 150dp: half-diagonal ≈78dp stays inside the mask.
          imageWidth: 150,
        },
        ios: {
          // Keep the existing iOS look: full-screen aspect-fit wordmark.
          enableFullScreenImage_legacy: true,
        },
      },
    ],
    "expo-router",
    "expo-video",
    "expo-secure-store",
    "expo-font",
    "expo-apple-authentication",
    ...(googleSignInPlugin ? [googleSignInPlugin] : []),
    [
      "expo-notifications",
      {
        // Android status-bar small icon uses ONLY the alpha channel (system
        // tints it); a fully opaque icon renders as a solid square. Must be a
        // transparent-background silhouette.
        icon: "./assets/notification-icon.png",
        color: "#01696f",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
          privacyManifestAggregationEnabled: true,
          // GoogleSignIn 9 pulls AppCheckCore (a Swift pod) which can't link as
          // a static library while its deps GoogleUtilities / RecaptchaInterop
          // emit no module maps. Flag those modular so CocoaPods generates them.
          extraPods: [
            { name: "GoogleUtilities", modular_headers: true },
            { name: "RecaptchaInterop", modular_headers: true },
          ],
        },
        android: {
          // AndroidX core 1.17 requires compiling against API 36+. Keep target SDK separate.
          compileSdkVersion: 36,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          enableProguardInReleaseBuilds: isProductionBuildProfile,
          enableShrinkResources: isProductionBuildProfile,
          ...(allowInsecureLocalHttp ? { usesCleartextTraffic: true } : {}),
        },
      },
    ],
  ],
});
