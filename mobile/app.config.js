/** @type {import('expo/config').ExpoConfig} */

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

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
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
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      {
        // REVERSED_CLIENT_ID; set EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME or we derive it from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.
        iosUrlScheme: googleIosUrlScheme || "",
      },
    ],
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
