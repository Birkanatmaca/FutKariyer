import { defineConfig } from 'vite';

const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};
export default defineConfig({
  base: '/securityadmin/',
  server: { proxy },
  preview: { proxy },
});
