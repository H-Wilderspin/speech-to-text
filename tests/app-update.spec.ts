import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Real HTTP responses are needed: page routes do not intercept worker updates.
async function releaseServer(base: string) {
  const state = { release: 1, failAsset: false };
  const root = resolve('dist');
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
    const relative = pathname.slice(base.length) || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) { response.writeHead(404).end(); return; }
    if (state.failAsset && relative === 'icon.svg') { response.writeHead(503).end(); return; }
    try {
      let body = await readFile(file);
      if (relative === 'sw.js') body = Buffer.from(body.toString().replace(/const version = '[^']+'/, `const version = 'test-release-${state.release}'`));
      if (relative === 'index.html') body = Buffer.from(body.toString().replace('<head>', `<head><meta name="test-release" content="${state.release}">`));
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  return { state, url: `http://127.0.0.1:${address.port}${base}`, close: () => new Promise<void>((done, reject) => {
    server.close(error => error ? reject(error) : done()); server.closeAllConnections();
  }) };
}

async function installed(page: Page, url: string) {
  await page.goto(url);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
const release = (page: Page) => page.locator('meta[name="test-release"]');
async function update(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Update app', exact: true }).click();
}

for (const base of ['/', '/speech-to-text/']) {
  test(`Update app installs a new release at ${base} and preserves saved access`, async ({ page, context }) => {
    const host = await releaseServer(base);
    try {
      await installed(page, host.url);
      await page.evaluate(async base => {
        localStorage.setItem(`speech-to-text-display:${base}`, JSON.stringify({ textSize: 40, language: 'fr-FR' }));
        localStorage.setItem(`speech-to-text-meal-editor:${base}`, 'test-only-saved-token');
        await caches.open(`speech-to-text:${location.origin}/another-app/:keep`);
      }, base);
      const other = await context.newPage(); await other.goto(host.url);
      host.state.release = 2;
      await update(page);
      await expect(release(page)).toHaveAttribute('content', '2');
      await expect(release(other)).toHaveAttribute('content', '1');
      await expect(page.getByRole('region', { name: 'Live transcript' })).toHaveCSS('font-size', '40px');
      expect(await page.evaluate(base => localStorage.getItem(`speech-to-text-meal-editor:${base}`), base)).toBe('test-only-saved-token');
      const keys = await page.evaluate(() => caches.keys());
      expect(keys.some(key => key.endsWith('/another-app/:keep'))).toBe(true);
      expect(keys.some(key => key.endsWith(':test-release-1'))).toBe(false);
      // A second press on the same release must also finish and reload.
      await update(page);
      await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
      await expect(release(page)).toHaveAttribute('content', '2');
      await context.setOffline(true); await page.reload();
      await expect(release(page)).toHaveAttribute('content', '2');
      await other.close();
    } finally { await context.setOffline(false); await host.close(); }
  });
}

test('offline and incomplete downloads keep the old app usable and allow retry', async ({ page, context }) => {
  const host = await releaseServer('/');
  try {
    await installed(page, host.url);
    await context.setOffline(true); await update(page);
    await expect(page.getByRole('alert').filter({ hasText: 'You’re offline.' })).toBeVisible();
    await expect(release(page)).toHaveAttribute('content', '1');
    await context.setOffline(false);
    host.state.release = 2; host.state.failAsset = true;
    await page.getByRole('button', { name: 'Update app', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /update/i })).toBeVisible({ timeout: 25000 });
    await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeEnabled();
    await expect(release(page)).toHaveAttribute('content', '1');
    host.state.failAsset = false;
    await page.getByRole('button', { name: 'Update app', exact: true }).click();
    await expect(release(page)).toHaveAttribute('content', '2');
  } finally { await context.setOffline(false); await host.close(); }
});

test('updates are disabled while listening or a planner is open', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void;
      onend?: () => void;
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeDisabled();
  await expect(page.getByText('Stop listening before updating.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Task planner', exact: true }).click();
  await page.getByRole('button', { name: 'Horizontal split (stacked)' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeDisabled();
  await expect(page.getByText('Close the planner before updating.')).toBeVisible();
  await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('dialog', { name: 'Task planner', exact: true }).getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeEnabled();
});
