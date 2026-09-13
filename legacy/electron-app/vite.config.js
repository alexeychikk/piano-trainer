/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const reactRefresh = require('@vitejs/plugin-react-refresh');
const { defineConfig } = require('vite');
const svgr = require('vite-plugin-svgr');
const tsconfigPaths = require('vite-tsconfig-paths').default;

const rendererPath = path.resolve(__dirname, './src/renderer');

// https://vitejs.dev/config/
module.exports = defineConfig({
  base: './',
  root: rendererPath,
  plugins: [tsconfigPaths(), reactRefresh(), svgr()],
  build: {
    target: 'chrome89',
  },
  resolve: {
    alias: [
      {
        find: '@src',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
});
