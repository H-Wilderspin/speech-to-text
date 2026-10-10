import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Precache only the build's explicitly enumerated public assets. Never cache speech.
function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicFiles = ['manifest.webmanifest', 'icon.svg', 'icons/icon-192.png',
        'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
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

export default defineConfig({
  base: './',
  plugins: [react(), offlineShell()],
  test: { include: ['src/**/*.test.ts', 'research/**/*.test.{ts,js}'], environment: 'node' },
});
