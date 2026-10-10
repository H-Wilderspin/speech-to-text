import { expect, test, type Page } from '@playwright/test';

async function mockRecognition(page: Page) {
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: unknown) => void;
      onerror?: (event: unknown) => void;
      start() { Object.assign(window, { testRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { Object.assign(window, { wasAborted: true }); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
}

async function result(page: Page, text: string, isFinal: boolean) {
  await page.evaluate(({ text, isFinal }) => {
    const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
    host.testRecognition?.onresult({ results: [{ 0: { transcript: text, confidence: .9 }, length: 1, isFinal }] });
  }, { text, isFinal });
}

test('anonymous listening, interim revision, stop, resume, clear, and no persistence', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await expect(page.locator('#processing-note')).toBeVisible();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'a blue', false); await result(page, 'a new day', true);
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('a new day');
  await expect(page.getByText('a blue', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'Another thought.', true);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.confirmed')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear text' }).click();
  await expect(page.locator('.confirmed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'Memory only.', true); await page.reload();
  await expect(page.getByText('Memory only.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('permission denial is actionable and a new gesture can recover', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onerror: (event: unknown) => void } };
    host.testRecognition?.onerror({ error: 'not-allowed' });
  });
  await expect(page.getByRole('status')).toContainText('site settings');
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Listening.');
});

test('growing hypotheses render once, listening restarts, and a spoken command stops it', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  for (let count = 1; count <= 3; count++) {
    await page.evaluate((count) => {
      const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
      host.testRecognition?.onresult({ results: ['We', 'We are', 'We are here.'].slice(0, count).map((text) => ({
        0: { transcript: text, confidence: .9 }, length: 1, isFinal: true,
      })) });
    }, count);
  }
  await expect(page.locator('.confirmed')).toHaveText(['We are here.']);
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onend: () => void }; previousRecognition?: unknown };
    host.previousRecognition = host.testRecognition;
    host.testRecognition?.onend();
  });
  await expect.poll(() => page.evaluate(() => {
    const host = window as Window & { testRecognition?: unknown; previousRecognition?: unknown };
    return host.testRecognition !== host.previousRecognition;
  })).toBe(true);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await result(page, 'All finished. Command stop.', true);
  await expect(page.getByRole('status')).toContainText('Stopped by voice command');
  await expect(page.locator('.confirmed')).toHaveText(['We are here.', 'All finished.']);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
});

test('unsupported capability preserves readable UI and accessible speaker dialog', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { SpeechRecognition: undefined, webkitSpeechRecognition: undefined }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('does not offer');
  await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to captions' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Speakers', exact: true })).toBeFocused();
});

test('page interruption aborts the microphone without clearing confirmed speech', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click(); await result(page, 'Keep this.', true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByRole('status')).toContainText('left the app');
  await expect(page.locator('.confirmed')).toHaveText('Keep this.');
  expect(await page.evaluate(() => (window as Window & { wasAborted?: boolean }).wasAborted)).toBe(true);
});

test('320px and larger text do not create horizontal overflow', async ({ page }) => {
  await mockRecognition(page); await page.setViewportSize({ width: 320, height: 740 }); await page.goto('/');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Larger text' }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'LongUnbrokenWord'.repeat(20), true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByRole('region').evaluate((element) => getComputedStyle(element).fontSize)).toBe('56px');
  await page.screenshot({ path: `test-results/mobile-${test.info().project.name}.png`, fullPage: true });
});

test('offline shell opens without claiming offline recognition', async ({ page, context }) => {
  await mockRecognition(page); await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Speech to Text' })).toBeVisible();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((entry) => entry.url)))).flat();
  });
  expect(cachedUrls.every((url) => url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
  expect(cachedUrls.some((url) => url.endsWith('index.html'))).toBe(true);
});

test('subdirectory deployment installs scoped assets and opens offline', async ({ page, context }) => {
  await mockRecognition(page);
  await page.goto('http://127.0.0.1:4174/speech-to-text/');
  await expect(page.getByRole('heading', { name: 'Speech to Text' })).toBeVisible();
  const scope = await page.evaluate(() => navigator.serviceWorker.ready.then((registration) => registration.scope));
  expect(scope).toBe('http://127.0.0.1:4174/speech-to-text/');
  const manifestResponse = await page.request.get(`${scope}manifest.webmanifest`);
  const manifest = await manifestResponse.json() as { icons: { src: string }[]; start_url: string };
  expect(manifest.start_url).toBe('./');
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, scope).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  await page.reload(); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', { name: 'Speech to Text' })).toBeVisible();
  await expect(page.getByText('You’re offline.', { exact: false })).toBeVisible();
});

test('reading earlier speech preserves scroll and newest restores it', async ({ page }) => {
  await mockRecognition(page); await page.goto('/');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await result(page, 'A readable sentence. '.repeat(200), true);
  const region = page.getByRole('region', { name: 'Live transcript' });
  await region.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await expect(page.getByRole('button', { name: 'Newest speech' })).toBeVisible();
  await page.evaluate(() => {
    const host = window as Window & { testRecognition?: { onresult: (event: unknown) => void } };
    host.testRecognition?.onresult({ results: [
      { 0: { transcript: 'A readable sentence. '.repeat(200), confidence: .9 }, length: 1, isFinal: true },
      { 0: { transcript: 'The newest thought.', confidence: .9 }, length: 1, isFinal: true },
    ] });
  });
  expect(await region.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: 'Newest speech' }).click();
  await expect(region).toBeFocused();
  expect(await region.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
});
