import { defineConfig } from 'vite';
import { resolve } from 'path';

const base = process.env.VITE_BASE || './';
const root = resolve(__dirname);

export default defineConfig({
  base,
  publicDir: false,
  resolve: {
    alias: [
      {
        find: /^three\/addons\/(.*)$/,
        replacement: resolve(root, 'vendor/three/addons') + '/$1'
      },
      {
        find: /^three$/,
        replacement: resolve(root, 'vendor/three/three.module.js')
      }
    ]
  },
  esbuild: {
    drop: ['console', 'debugger']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(root, 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('vendor/three')) return 'three';
          if (id.includes('/src/net/')) return 'net';
          if (id.includes('/src/sim/')) return 'sim';
        }
      }
    }
  },
  server: {
    port: 8080,
    fs: { strict: true }
  },
  plugins: [
    {
      name: 'serve-wasm-dev',
      async configureServer(server) {
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/wasm/')) {
            const file = resolve(__dirname, '.' + req.url.split('?')[0]);
            if (existsSync(file)) {
              res.setHeader('Content-Type', 'application/wasm');
              res.end(readFileSync(file));
              return;
            }
          }
          next();
        });
      }
    },
    {
      name: 'copy-static-roots',
      async closeBundle() {
        const { cpSync, existsSync, readdirSync } = await import('fs');
        const { join } = await import('path');
        const dist = resolve(root, 'dist');
        for (const dir of ['vendor', 'assets', 'styles', 'wasm']) {
          const src = resolve(root, dir);
          if (!existsSync(src)) continue;
          try {
            if (readdirSync(src).length === 0) continue;
          } catch (_) { continue; }
          cpSync(src, join(dist, dir), { recursive: true });
        }
      }
    }
  ]
});
