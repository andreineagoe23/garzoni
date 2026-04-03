/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || undefined,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      {
        // Must match the iOS OAuth client’s REVERSED_CLIENT_ID (set in .env / EAS secrets; not committed).
        iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() || "",
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
