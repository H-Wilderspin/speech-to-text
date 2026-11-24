import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

// Precache only the build's explicitly enumerated public assets. Never cache speech.
function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicFiles = ['manifest.webmanifest', 'icon.svg', 'icons/icon-192.png',
        'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
        'fonts/Poppins-Regular.ttf', 'fonts/Poppins-SemiBold.ttf', 'fonts/OFL.txt'];
      // Vite emits index.html in a later hook, so enumerate it explicitly.
      const files = [...new Set(['index.html', ...Object.keys(bundle), ...publicFiles])];
      const worker = readFileSync(new URL('./src/app/service-worker.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(worker).update(readFileSync(new URL('./index.html', import.meta.url)));
      for (const item of Object.values(bundle)) hash.update(item.type === 'chunk' ? item.code : item.source);
      for (const file of publicFiles) hash.update(readFileSync(new URL(`./public/${file}`, import.meta.url)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker
        .replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 16))
        .replaceAll('__PRECACHE_FILES__', JSON.stringify(files)) });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const service = loadEnv(mode, process.cwd(), 'VITE_').VITE_SYNC_SERVICE_URL;
  const proxy = command === 'serve' && mode === 'development' && !!service;
  return {
    base: './',
    plugins: [react(), offlineShell()],
    // Development uses the same pairing UI without widening the Worker's CORS policy.
    // Only device endpoints are proxied; owner credentials stay outside Vite.
    define: proxy ? { 'import.meta.env.VITE_SYNC_SERVICE_URL': JSON.stringify('/family-sync') } : {},
    server: proxy ? { proxy: {
      '^/family-sync/(session|pair|files)(\\?|$)': {
        target: service, changeOrigin: true,
        headers: { Origin: 'https://h-wilderspin.github.io' },
        rewrite: path => path.replace(/^\/family-sync/, ''),
      },
    } } : {},
    test: { include: ['src/**/*.test.ts', 'service/**/*.test.ts'], environment: 'node' },
  };
});
