import { getDefaultConfig } from 'expo/metro-config.js';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, '../..');
const require = createRequire(import.meta.url);
const reactRoot = path.dirname(require.resolve('react/package.json'));
const reactDomRoot = path.dirname(require.resolve('react-dom/package.json'));

const config = getDefaultConfig(projectRoot);
const defaultResolveRequest = config.resolver.resolveRequest;
const mobileReactResolutions = new Map([
  ['react', require.resolve('react')],
  ['react/jsx-runtime', require.resolve('react/jsx-runtime')],
  ['react/jsx-dev-runtime', require.resolve('react/jsx-dev-runtime')],
  ['react-dom', require.resolve('react-dom')],
  ['react-dom/client', require.resolve('react-dom/client')],
  ['react-dom/server', require.resolve('react-dom/server')],
]);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: reactRoot,
  'react-dom': reactDomRoot,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedResolution = mobileReactResolutions.get(moduleName);

  if (forcedResolution) {
    return context.resolveRequest(context, forcedResolution, platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

export default config;
