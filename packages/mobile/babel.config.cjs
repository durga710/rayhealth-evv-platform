// babel-preset-expo registers the expo-router and react-native-worklets plugins
// only when it can resolve those packages from its own install location. In this
// monorepo the preset is hoisted to the workspace root while some packages may be
// nested here, so the preset can silently skip them. Register a plugin explicitly
// only when the preset would miss it (adding it unconditionally would duplicate).
const path = require('path');

const presetDir = path.dirname(require.resolve('babel-preset-expo/package.json'));
function presetCanResolve(mod) {
  try {
    require.resolve(mod, { paths: [presetDir] });
    return true;
  } catch {
    return false;
  }
}

const plugins = [];
if (!presetCanResolve('expo-router')) {
  plugins.push(require('babel-preset-expo/build/expo-router-plugin').expoRouterBabelPlugin);
}
if (!presetCanResolve('react-native-worklets')) {
  plugins.push(require('react-native-worklets/plugin'));
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
