import { readdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Model-only test: allow preparation even on WebKit ports without Web Audio.
// Constructors throw if accidentally used; no microphone recording is simulated.
test('model preparation survives worker disposal and offline reload in both engines', async ({ page, context }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    class UnusedAudio { constructor() { throw new Error('This test must not start recording.'); } }
    Object.assign(globalThis, { AudioContext: UnusedAudio, OfflineAudioContext: UnusedAudio, AudioWorkletNode: UnusedAudio });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => { throw new Error('This test must not request a microphone.'); } } });
  });
  const requests: string[] = [];
  page.on('request', (request) => { if (/speaker\/v1\//.test(request.url())) requests.push(request.url()); });
  const open = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();

  };
  await page.goto('/'); await open();
  await page.getByRole('button', { name: 'Prepare voice model' }).click();
  await expect(page.getByRole('button', { name: 'Record (20 seconds)' })).toBeVisible({ timeout: 30000 });
  expect(requests).toHaveLength(3);
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true); await page.reload(); await open();
  await expect(page.getByRole('button', { name: 'Record (20 seconds)' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Prepare voice model' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to captions' }).click();

  // Real native inference from retained public assets, without a microphone.
  const files = await readdir(new URL('../dist/assets/', import.meta.url));
  const workerFile = files.find((name) => /^embedding\.worker-.*\.js$/.test(name));
  expect(workerFile).toBeTruthy();
  const result = await page.evaluate(async ({ workerFile }) => {
    const key = (await caches.keys()).find((key) => key.startsWith('speech-to-text-model:'))!;
    const cache = await caches.open(key);
    const assets = await Promise.all(['embedding.onnx', 'speaker-runtime.wasm', 'speaker-runtime.mjs'].map(async (name) => {
      const response = await cache.match(new URL(`speaker/v1/${name}`, location.href).href);
      if (!response) throw new Error('Missing retained model asset.');
      return new Uint8Array(await response.arrayBuffer());
    }));
    const worker = new Worker(`/assets/${workerFile}`, { type: 'module' });
    let sequence = 0;
    const request = (value: object, transfer: Transferable[] = []) => new Promise<{ embedding?: Float32Array }>((resolve, reject) => {
      const id = ++sequence;
      worker.onerror = () => reject(new Error('Model worker failed.'));
      worker.onmessage = ({ data }) => { if (data.id === id) { if (data.error) reject(new Error(data.error)); else resolve(data); } };
      worker.postMessage({ id, ...value }, transfer);
    });
    const samples = Float32Array.from({ length: 48000 }, (_, index) => .1 * Math.sin(index * 2 * Math.PI * 173 / 16000));
    let embedding: Float32Array | undefined;
    try {
      await request({ assets }, assets.map((asset) => asset.buffer));
      ({ embedding } = await request({ samples }));
      return { dimension: embedding?.length, valid: Boolean(embedding?.every(Number.isFinite) && Math.hypot(...embedding) > 0) };
    } finally { samples.fill(0); embedding?.fill(0); worker.terminate(); }
  }, { workerFile });
  expect(result).toEqual({ dimension: 192, valid: true }); expect(requests).toHaveLength(3);
});
