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

/** Only register the config plugin when scheme is set (EAS cloud has no local .env unless you add EAS env). */
const googleSignInPlugin = googleIosUrlScheme
  ? [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: googleIosUrlScheme,
      },
    ]
  : null;

if (!googleIosUrlScheme && process.env.EAS_BUILD === "true") {
  // eslint-disable-next-line no-console
  console.warn(
    "[app.config] Google Sign-In iOS URL scheme missing. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID or " +
      "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME in EAS project secrets (or eas.json env) to enable native Google login on iOS.",
  );
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
  process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase() === "development" ||
  process.env.EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_HTTP === "1";

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    requireFullScreen: true,
    infoPlist: {
      ...config.ios?.infoPlist,
      UIDeviceFamily: [1],
      NSPhotoLibraryUsageDescription:
        "Allow Garzoni to choose a profile photo from your library (shown on this device until you update your avatar in account settings).",
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
    ...(allowInsecureLocalHttp ? { usesCleartextTraffic: true } : {}),
  },
  extra: {
    ...(config.extra ?? {}),
    /** `development` | `production` — used for native policy and optional runtime checks. */
    appEnv: process.env.EXPO_PUBLIC_APP_ENV?.trim() || undefined,
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
    "expo-router",
    "expo-video",
    "expo-secure-store",
    "expo-font",
    "expo-apple-authentication",
    ...(googleSignInPlugin ? [googleSignInPlugin] : []),
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#01696f",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.1",
          privacyManifestAggregationEnabled: true,
        },
      },
    ],
  ],
});
