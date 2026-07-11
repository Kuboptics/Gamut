module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo automatically detects react-native-worklets (a
    // dependency of react-native-reanimated) and adds its babel plugin
    // for us — do NOT also list 'react-native-worklets/plugin' or
    // 'react-native-reanimated/plugin' below, or the plugin runs twice.
    presets: ['babel-preset-expo'],
  };
};
