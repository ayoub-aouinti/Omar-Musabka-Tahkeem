module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated's plugin powers @gorhom/bottom-sheet and MUST be listed last.
    plugins: ["react-native-reanimated/plugin"],
  };
};
