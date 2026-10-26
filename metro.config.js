const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const emptyModulePath = path.resolve(__dirname, 'src/shims/empty.js');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('node:') || moduleName.startsWith('#wasm-')) {
        return {
          filePath: emptyModulePath,
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

