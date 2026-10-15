import { expect, test } from '@playwright/test';

test('MVP upgrade removes only this app’s retired data and keeps reading preferences', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem('speech-to-text-display:/', JSON.stringify({ textSize: 40, language: 'fr-FR', colours: { example: '#abcdef' }, hiddenSpeakers: ['example'], assignedCollapsed: false }));
    localStorage.setItem('speech-to-text-name-suggestions:/', 'enabled');
    localStorage.setItem('speech-to-text-display:/other/', 'untouched');
    for (const name of ['speech-to-text-speakers:/', 'speech-to-text-speakers:/other/']) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('profiles');
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error);
      });
    }
    for (const name of [
      `speech-to-text-model:${location.origin}/speaker/v1/:old`,
      `speech-to-text-local:${location.origin}/local/v1/:old`,
      `speech-to-text-asr:${location.origin}/local/v2/:old`,
      `speech-to-text-model:${location.origin}/other/speaker/v1/:old`,
    ]) await caches.open(name);
  });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Live transcript' })).toHaveCSS('font-size', '40px');
  await expect(page.getByRole('button', { name: 'Who said what' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Speech language')).toHaveValue('fr-FR');
  await expect(page.getByRole('heading', { name: 'People & colours' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('speech-to-text-display:/')!))).toEqual({ textSize: 40, language: 'fr-FR' });
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-name-suggestions:/'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('speech-to-text-display:/other/'))).toBe('untouched');
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).filter((key) => /^speech-to-text-(model|local|asr):/.test(key)))).toEqual([
    'speech-to-text-model:http://127.0.0.1:4173/other/speaker/v1/:old',
  ]);
  // Opening without a version detects absence without depending on databases(),
  // which older browsers may not expose. Remove the empty probe DB afterwards.
  const exists = (name: string) => page.evaluate((name) => new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open(name);
    let existing = true;
    request.onupgradeneeded = () => { existing = false; };
    request.onsuccess = () => { request.result.close(); if (!existing) indexedDB.deleteDatabase(name); resolve(existing); };
    request.onerror = () => reject(request.error);
  }), name);
  expect(await exists('speech-to-text-speakers:/')).toBe(false);
  expect(await exists('speech-to-text-speakers:/other/')).toBe(true);
  expect(requests.some((url) => /\/(speaker|local)\/|\.wasm(?:$|\?)/.test(url))).toBe(false);
});

test('storage restrictions do not prevent the MVP from opening', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'indexedDB', 'caches']) Object.defineProperty(window, name, {
      configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Live transcript' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Speech language')).toBeVisible();
  expect(errors).toEqual([]);
});
