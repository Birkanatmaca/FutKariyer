import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const extensions = [
  '.web.tsx',
  '.web.ts',
  '.web.jsx',
  '.web.js',
  '.mjs',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
];
const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api/, ''),
  },
};

export default defineConfig(({ mode }) => ({
  // react-native's Animated reads `global`, which browsers do not define.
  define: { __DEV__: mode !== 'production', global: 'globalThis' },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      {
        find: /^react-native-svg$/,
        replacement: fileURLToPath(
          new URL(
            './node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js',
            import.meta.url,
          ),
        ),
      },
    ],
    extensions,
  },
  optimizeDeps: {
    rolldownOptions: {
      resolve: { extensions },
      transform: {
        define: {
          __DEV__: JSON.stringify(mode !== 'production'),
          global: 'globalThis',
        },
      },
    },
  },
  server: { proxy },
  preview: { proxy },
  build: { outDir: '../artifacts/web', emptyOutDir: false },
}));
