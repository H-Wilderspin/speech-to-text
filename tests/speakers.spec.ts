import { expect, test, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';

// Real AudioWorklet, resampling, WASM and IndexedDB. Replace permission and
// MediaStreamAudioSource with a tone in the consumer context, not OS microphone routing.
async function syntheticMicrophone(page: Page, delayed = false) {
  await page.goto('/');
  const audioSupported = await page.evaluate(() => Boolean(globalThis.AudioContext && globalThis.AudioWorkletNode && globalThis.OfflineAudioContext));
  test.skip(process.platform === 'win32' && test.info().project.name === 'mobile-webkit' && !audioSupported,
    'Playwright WebKit on Windows exposes no Web Audio APIs; real capture needs another platform or physical Safari.');
  expect(audioSupported).toBe(true);
  await page.addInitScript(({ delayed }) => {
    let calls = 0; let stops = 0;
    const NativeAudioContext = globalThis.AudioContext;
    const recordingContexts: AudioContext[] = [];
    const streams = new WeakMap<MediaStream, { destination: MediaStreamAudioDestinationNode; release: () => void }>();
    class SyntheticAudioContext extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); recordingContexts.push(this); }
      createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
        const fixture = streams.get(stream);
        if (!fixture) return super.createMediaStreamSource(stream);
        const oscillator = this.createOscillator(); oscillator.frequency.value = 173;
        const gain = this.createGain(); gain.gain.value = .1;
        oscillator.connect(gain); oscillator.start();
        fixture.release = () => { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); };
        // Capture only uses AudioNode.connect/disconnect on this source. Its real
        // worklet emits silence; the generated tone never reaches the speakers.
        return gain as unknown as MediaStreamAudioSourceNode;
      }
    }
    Object.assign(globalThis, { AudioContext: SyntheticAudioContext });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      calls++;
      const recordingContext = recordingContexts.pop();
      if (!recordingContext) throw new Error('Synthetic input requires the recorder context.');
      const destination = recordingContext.createMediaStreamDestination();
      const fixture = { destination, release: () => {} };
      streams.set(destination.stream, fixture);
      const track = destination.stream.getAudioTracks()[0]!;
      const stop = track.stop.bind(track);
      track.stop = () => { stops++; stop(); fixture.release(); streams.delete(destination.stream); };
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
  await page.goto(url); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
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

test('project-path lazy model, offline reuse, consent, real enrolment, persisted profile and deletion', async ({ page, context }) => {
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
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Voice profile saved on this device.', { timeout: 30000 });
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
  const downloads = modelRequests.length;
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record 8 seconds', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Prepare voice model' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Compare recordings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to saved speakers' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Add a speaker' })).toHaveCount(0);
  await page.getByLabel('Saved voice to compare').selectOption({ label: 'Synthetic test' });
  await page.getByLabel('Who is recording?').selectOption('same');
  const compare = page.getByRole('button', { name: 'Record comparison (8 seconds)', exact: true });
  await expect(compare).toBeVisible({ timeout: 30000 }); await expect(compare).toBeDisabled();
  expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
  await page.getByRole('checkbox').check(); await compare.click();
  await expect(page.locator('.comparison p[role="status"]')).toHaveText('Comparison complete. No profile was changed.', { timeout: 30000 });
  expect(modelRequests).toHaveLength(downloads);
  await context.setOffline(false);
  const score = Number(await page.getByLabel('Similarity score').innerText());
  expect(Number.isFinite(score)).toBe(true); expect(score).toBeGreaterThanOrEqual(-1); expect(score).toBeLessThanOrEqual(1);
  expect(await stats(page)).toEqual({ calls: 1, stops: 1 });
  await expect(page.getByText('No match threshold has been validated.', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await page.getByText('All 1 temporary results', { exact: true }).click();
  expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await compare.click(); await expect.poll(() => stats(page)).toEqual({ calls: 2, stops: 1 });
  await page.getByRole('button', { name: 'Cancel comparison', exact: true }).click();
  await expect.poll(() => stats(page)).toEqual({ calls: 2, stops: 2 });
  await expect(page.getByLabel('Similarity score')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to saved speakers' }).click();
  await expect(page.getByRole('button', { name: 'Compare recordings', exact: true })).toBeFocused();
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete Synthetic test', exact: true })).toHaveCount(1);
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('speech-to-text-speakers:/speech-to-text/', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('profiles'); const request = tx.objectStore('profiles').getAll();
        tx.oncomplete = () => resolve({ stores: Array.from(db.objectStoreNames), count: request.result.length,
          normalized: Math.abs(Math.hypot(...request.result[0].embedding as number[]) - 1) < .0001 });
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  expect(persisted).toEqual({ stores: ['profiles'], count: 1, normalized: true });
  await page.getByRole('button', { name: 'Delete Synthetic test', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)))).flat());
  expect(cached.filter((url) => /speaker\/v1\//.test(url)).map((url) => url.split('/').at(-1)).sort()).toEqual(['embedding.onnx', 'speaker-runtime.mjs', 'speaker-runtime.wasm']);
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
  await page.getByRole('button', { name: 'Back to settings' }).click();
  await page.evaluate(() => (window as Window & { resolvePermission?: () => void }).resolvePermission?.());
  await expect.poll(() => stats(page)).toEqual({ calls: 1, stops: 1 });
  await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
});

test('model failure and cancellation recover without requesting a microphone', async ({ page }) => {
  await syntheticMicrophone(page);
  // WebKit's dedicated-worker fetch bypassed page.route in Linux CI. A real
  // loopback HTTP failure exercises the same production worker in every engine.
  let failModel = true; let failedRequests = 0;
  const server = createServer((request, response) => {
    void (async () => {
      if (failModel && request.url?.split('?')[0] === '/speaker/v1/embedding.onnx') {
        failedRequests++; response.writeHead(503, { 'Cache-Control': 'no-store' }); response.end(); return;
      }
      const upstream = await fetch(`http://127.0.0.1:4173${request.url ?? '/'}`);
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    })().catch(() => { if (!response.headersSent) response.writeHead(502); response.end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing failure-test server address.');
    await openSpeakers(page, `http://127.0.0.1:${address.port}/`);
    await page.getByRole('button', { name: 'Prepare voice model' }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Voice model download failed.');
    expect(failedRequests).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Prepare voice model' })).toBeVisible();
    expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
    failModel = false;
    await page.getByRole('button', { name: 'Prepare voice model' }).click();
    await page.getByRole('button', { name: 'Cancel enrolment' }).click();
    await expect(page.getByRole('button', { name: 'Prepare voice model' })).toBeVisible();
    expect(await stats(page)).toEqual({ calls: 0, stops: 0 });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('unavailable storage is actionable and leaves captions accessible', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined }); });
  await openSpeakers(page);
  await expect(page.getByText('This browser does not offer local speaker storage.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to settings' }).click();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
});

test('unsupported audio preserves profile management and explains recording fallback', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'AudioWorkletNode', { value: undefined }); });
  await openSpeakers(page);
  await expect(page.getByText('This browser does not support local voice recording. Live captions may still be available.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare voice model' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to settings' }).click();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
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
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete synthetic-one', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete all profiles' }).click(); await page.getByRole('button', { name: 'Keep profiles' }).click();
  await expect(page.getByRole('button', { name: 'Delete synthetic-two', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete all profiles' }).click(); await page.getByRole('button', { name: 'Confirm delete all' }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Speakers', exact: true }).click();
  await expect(page.getByText('No saved speakers on this device.')).toBeVisible();
});

test('speaker form stays usable at 320px with large system text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await openSpeakers(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
  await page.getByLabel('Display name').fill('A long synthetic test name');
  await page.getByRole('checkbox').check();
  expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to settings' }).click();
  await expect(page.getByRole('button', { name: 'Speakers', exact: true })).toBeFocused();
});
