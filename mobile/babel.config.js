module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Hermes has no import.meta; @garzoni/core uses it for EXPO_PUBLIC_* via publicEnv.ts
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      ...(process.env.EXPO_PUBLIC_APP_ENV === "production" ||
      process.env.EAS_BUILD_PROFILE === "production"
        ? [["transform-remove-console", { exclude: ["error"] }]]
        : []),
      "react-native-reanimated/plugin",
    ],
  };
};
