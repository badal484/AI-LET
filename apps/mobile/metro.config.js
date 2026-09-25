const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'cjs', 'mjs'],
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    resolveRequest: (context, moduleName, platform) => {
      try {
        return context.resolveRequest(context, moduleName, platform);
      } catch (err) {
        if (moduleName.endsWith('.js')) {
          const stripped = moduleName.slice(0, -3);
          try {
            return context.resolveRequest(context, stripped, platform);
          } catch {
            throw err;
          }
        }
        throw err;
      }
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
