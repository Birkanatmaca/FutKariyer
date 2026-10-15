import {
  defineConfig,
  type Plugin,
  type PreviewServer,
  type ViteDevServer,
} from 'vite';

function adminEntryRedirect(): Plugin {
  const configure = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname === '/securityadmin') {
        response.writeHead(307, { Location: '/securityadmin/' + url.search });
        response.end();
        return;
      }
      next();
    });
  };
  return {
    name: 'admin-entry-redirect',
    configureServer: configure,
    configurePreviewServer: configure,
  };
}

const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8080',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};
export default defineConfig({
  base: '/securityadmin/',
  plugins: [adminEntryRedirect()],
  server: { proxy },
  preview: { proxy },
});
