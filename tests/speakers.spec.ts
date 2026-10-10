import { expect, test, type Page } from '@playwright/test';

// Real AudioWorklet, resampling, WASM and IndexedDB; synthetic input replaces only the microphone.
async function syntheticMicrophone(page: Page, delayed = false) {
  await page.goto('/');
  const audioSupported = await page.evaluate(() => Boolean(globalThis.AudioContext && globalThis.AudioWorkletNode && globalThis.OfflineAudioContext));
  test.skip(process.platform === 'win32' && test.info().project.name === 'mobile-webkit' && !audioSupported,
    'Playwright WebKit on Windows exposes no Web Audio APIs; real capture needs another platform or physical Safari.');
  expect(audioSupported).toBe(true);
  await page.addInitScript(({ delayed }) => {
    let calls = 0; let stops = 0;
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      calls++;
      const context = new AudioContext(); await context.resume();
      const oscillator = context.createOscillator(); oscillator.frequency.value = 173;
      const gain = context.createGain(); gain.gain.value = .1;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(gain); gain.connect(destination); oscillator.start();
      const track = destination.stream.getAudioTracks()[0]!;
      const stop = track.stop.bind(track);
      track.stop = () => { stops++; stop(); oscillator.stop(); void context.close(); };
      if (delayed) await new Promise<void>((resolve) => Object.assign(window, { resolvePermission: resolve }));
      return destination.stream;
    } } });
    Object.assign(window, { microphoneStats: () => ({ calls, stops }) });
  }, { delayed });
}
async function stats(page: Page) {
  return page.evaluate(() => (window as Window & { microphoneStats?: () => { calls: number; stops: number } }).microphoneStats?.());
}
async function openSpeakers(page: Page, url = '/') {
  await page.goto(url); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function prepare(page: Page) {
  await page.getByRole('button', { name: 'Prepare voice model' }).click();
  await expect(page.getByRole('button', { name: 'Record 8 seconds' })).toBeVisible({ timeout: 30000 });
}
async function agree(page: Page, name = 'Synthetic test') {
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('checkbox').check();
}

test('project-path lazy model, consent, real enrolment, persisted profile and deletion', async ({ page }) => {
  test.setTimeout(90000);
  await syntheticMicrophone(page);
  const modelRequests: string[] = [];
  page.on('request', (request) => { if (/speaker\/v1\//.test(request.url())) modelRequests.push(request.url()); });
  await openSpeakers(page, 'http://127.0.0.1:4174/speech-to-text/');
  expect(modelRequests).toHaveLength(0); expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
  await prepare(page);
  expect(modelRequests.some((url) => url.endsWith('embedding.onnx'))).toBe(true);
  expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
  const record = page.getByRole('button', { name: 'Record 8 seconds' });
  await expect(record).toBeDisabled(); await agree(page);
  await record.click();
  await expect(page.getByRole('button', { name: 'Delete Synthetic test', exact: true })).toBeVisible({ timeout: 30000 });
  expect(await stats(page)).toEqual({ calls: 1, stops: 1 });
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('speech-to-text-speakers:/speech-to-text/', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('profiles'); const request = tx.objectStore('profiles').getAll();
        tx.oncomplete = () => resolve(request.result.map((profile: { embedding: number[]; consentVersion: string; schemaVersion: number }) => ({
          keys: Object.keys(profile).sort(), dimension: profile.embedding.length,
          normalized: Math.abs(Math.hypot(...profile.embedding) - 1) < .0001, consent: profile.consentVersion, schema: profile.schemaVersion,
        })));
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  expect(stored).toEqual([{
    keys: ['consentVersion', 'consentedAt', 'createdAt', 'displayName', 'embedding', 'id', 'modelVersion', 'sampleDurationMs', 'schemaVersion'].sort(),
    dimension: 192, normalized: true, consent: 'local-voiceprint-v1', schema: 1,
  }]);
  await page.reload(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Synthetic test', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)))).flat());
  expect(cached.some((url) => /speaker\/v1\//.test(url))).toBe(false);
});

test('leaving the page during recording stops capture and does not save a profile', async ({ page }) => {
  test.setTimeout(60000); await syntheticMicrophone(page); await openSpeakers(page); await prepare(page); await agree(page);
  await page.getByRole('button', { name: 'Record 8 seconds' }).click();
  await expect.poll(() => stats(page)).toEqual({ calls: 1, stops: 0 });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => stats(page)).toEqual({ calls: 1, stops: 1 });
  await expect(page.getByText('Cancelled. Unfinished audio and voiceprints were discarded.')).toBeVisible();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
});

test('closing during a permission prompt stops a microphone granted afterward', async ({ page }) => {
  test.setTimeout(60000); await syntheticMicrophone(page, true); await openSpeakers(page); await prepare(page); await agree(page);
  await page.getByRole('button', { name: 'Record 8 seconds' }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as Window & { resolvePermission?: () => void }).resolvePermission)).toBe('function');
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.evaluate(() => (window as Window & { resolvePermission?: () => void }).resolvePermission?.());
  await expect.poll(() => stats(page)).toEqual({ calls: 1, stops: 1 });
  await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
});

test('model failure and cancellation recover without requesting a microphone', async ({ page }) => {
  await syntheticMicrophone(page);
  await page.route('**/speaker/v1/embedding.onnx', (route) => route.abort());
  await openSpeakers(page); await page.getByRole('button', { name: 'Prepare voice model' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Voice model download failed.');
  await expect(page.getByRole('button', { name: 'Prepare voice model' })).toBeVisible();
  expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
  await page.unroute('**/speaker/v1/embedding.onnx');
  await page.getByRole('button', { name: 'Prepare voice model' }).click();
  await page.getByRole('button', { name: 'Cancel enrolment' }).click();
  await expect(page.getByRole('button', { name: 'Prepare voice model' })).toBeVisible();
  expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
});

test('unavailable storage is actionable and leaves captions accessible', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); });
  await openSpeakers(page);
  await expect(page.getByText('This browser does not offer local speaker storage.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(page.getByRole('heading', { name: 'Speech to Text' })).toBeVisible();
});

test('unsupported audio preserves profile management and explains recording fallback', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'AudioWorkletNode', { value: undefined }); });
  await openSpeakers(page);
  await expect(page.getByText('This browser does not support local voice recording. Live captions may still be available.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare voice model' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(page.getByRole('heading', { name: 'Speech to Text' })).toBeVisible();
});

test('clear-all requires confirmation and deletes real IndexedDB rows across reload', async ({ page }) => {
  await openSpeakers(page);
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('speech-to-text-speakers:/', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('profiles', 'readwrite');
        for (const id of ['synthetic-one', 'synthetic-two']) tx.objectStore('profiles').add({
          schemaVersion: 1, id, displayName: id, createdAt: new Date().toISOString(), consentedAt: new Date().toISOString(),
          consentVersion: 'local-voiceprint-v1', modelVersion: 'test-only-synthetic', sampleDurationMs: 8000, embedding: [1, 0],
        });
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  await page.reload(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete synthetic-one', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete all profiles' }).click(); await page.getByRole('button', { name: 'Keep profiles' }).click();
  await expect(page.getByRole('button', { name: 'Delete synthetic-two', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete all profiles' }).click(); await page.getByRole('button', { name: 'Confirm delete all' }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
});

test('speaker form stays usable at 320px with large system text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await openSpeakers(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await page.getByLabel('Display name').fill('A long synthetic test name');
  await page.getByRole('checkbox').check();
  expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(page.getByRole('button', { name: 'Speakers', exact: true })).toBeFocused();
});
