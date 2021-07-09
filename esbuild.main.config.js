/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { TsconfigPathsPlugin } = require('@esbuild-plugins/tsconfig-paths');

/**
 * @type {Partial<import('esbuild').BuildOptions>}
 */
module.exports = {
  platform: 'node',
  entryPoints: [path.resolve('src/main/main.ts')],
  bundle: true,
  target: 'node14.16.0', // electron version target
  loader: {
    '.ts': 'ts',
  },
  plugins: [TsconfigPathsPlugin({ tsconfig: 'tsconfig.json' })],
};
