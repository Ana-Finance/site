import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve, join, normalize } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** En développement, sert aussi le site public (racine du repo) pour l'aperçu et l'éditeur. */
function servePublicSite(): Plugin {
  const types: Record<string, string> = { html: 'text/html', css: 'text/css', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', json: 'application/json', webp: 'image/webp' };
  return {
    name: 'ana-serve-public-site',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '/').split('?')[0];
        if (url.startsWith('/admin/') || url.startsWith('/@') || url.startsWith('/node_modules/')) return next();
        const file = normalize(join(repoRoot, decodeURIComponent(url === '/' ? '/index.html' : url)));
        if (!file.startsWith(repoRoot) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('content-type', types[file.split('.').pop() || ''] || 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Chemins relatifs : fonctionne sous /site/admin/ (github.io) comme sous /admin/ (domaine personnalisé).
  base: command === 'build' ? './' : '/admin/',
  plugins: [react(), servePublicSite()],
  resolve: { alias: { '@cms': resolve(repoRoot, 'cms/core.js') } },
  envDir: repoRoot,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  server: { fs: { allow: [repoRoot] } },
}));
