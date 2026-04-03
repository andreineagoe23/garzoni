/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme:
          process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() ||
          "com.googleusercontent.apps.285624538344-cppis8r1s9hspg7qgubug42mrk79452a",
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
