module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 57) auto-includes the react-native-worklets plugin
  // when reanimated is installed — no manual plugin entry needed.
  return {
    presets: ['babel-preset-expo'],
  };
};
