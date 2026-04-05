module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Hermes has no import.meta; @monevo/core uses it for EXPO_PUBLIC_* via publicEnv.ts
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
