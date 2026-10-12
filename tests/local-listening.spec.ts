import { readFile, readdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import localFiles from '../local-assets.json' with { type: 'json' };
import asr from '../local-asr-assets.json' with { type: 'json' };
import speakerModel from '../speaker-assets.json' with { type: 'json' };

async function fixtureSamples(name: string) {
  const bytes = await readFile(new URL(`./fixtures/${name}.wav`, import.meta.url));
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === 'data') return Array.from({ length: size / 2 }, (_, index) => bytes.readInt16LE(offset + 8 + index * 2) / 32768);
    offset += 8 + size + size % 2;
  }
  throw new Error('Missing generated audio fixture.');
}

async function prepareModels(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare voice model' }).click();
  await expect(page.getByRole('button', { name: 'Record 8 seconds' })).toBeVisible({ timeout: 60000 });
  const reference = await createGeneratedProfile(page, true); reference.embedding.fill(0);
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.name-preparation [role=status]')).toContainText('Ready. Names are estimates;', { timeout: 60000 });
  await expect(page.getByRole('checkbox')).toHaveCount(0);
}

async function preparationOnlyAudio(page: Page) {
  await page.addInitScript(() => {
    class UnusedAudio { constructor() { throw new Error('Microphone must not open during model preparation.'); } }
    Object.assign(globalThis, { AudioContext: UnusedAudio, OfflineAudioContext: UnusedAudio, AudioWorkletNode: UnusedAudio });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => { throw new Error('Unexpected microphone'); } } });
  });
}

async function createGeneratedProfile(page: Page, save: boolean) {
  const files = await readdir(new URL('../dist/assets/', import.meta.url));
  const workerFile = files.find((name) => /^embedding\.worker-.*\.js$/.test(name))!;
  return page.evaluate(async ({ workerFile, samples, version, save }) => {
    const key = (await caches.keys()).find((key) => key.startsWith('speech-to-text-model:'))!;
    const cache = await caches.open(key);
    const assets = await Promise.all(['embedding.onnx', 'speaker-runtime.wasm', 'speaker-runtime.mjs'].map(async (name) => new Uint8Array(await (await cache.match(new URL(`speaker/v1/${name}`, location.href).href))!.arrayBuffer())));
    const worker = new Worker(`/assets/${workerFile}`, { type: 'module' });
    let sequence = 0;
    const request = (data: object) => new Promise<{ embedding?: Float32Array }>((resolve, reject) => {
      const id = ++sequence; worker.onerror = () => reject(new Error('Embedding worker failed'));
      worker.onmessage = ({ data }) => { if (data.id === id) { if (data.error) reject(new Error(data.error)); else resolve(data); } };
      worker.postMessage({ id, ...data });
    });
    try {
      await request({ assets }); const { embedding } = await request({ samples: new Float32Array(samples) });
      if (!embedding) throw new Error('Missing generated voiceprint');
      const reference = { id: 'generated-test', name: 'Generated test voice', embedding: Array.from(embedding) }; embedding.fill(0);
      if (save) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('speech-to-text-speakers:/', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('profiles', { keyPath: 'id' });
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        try { await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('profiles', 'readwrite'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
          tx.objectStore('profiles').put({ schemaVersion: 1, id: reference.id, displayName: reference.name, embedding: reference.embedding,
            modelVersion: version, consentVersion: 'local-voiceprint-v1', createdAt: new Date().toISOString(), consentedAt: new Date().toISOString(), sampleDurationMs: 8000 });
        }); } finally { db.close(); }
      }
      return reference;
    } finally { worker.terminate(); }
  }, { workerFile, samples: await fixtureSamples('voice-a-profile'), version: speakerModel.version, save });
}

test('real local worker reuses offline models and suggests a known generated voice, not every voice', async ({ page, context }) => {
  test.setTimeout(180000);
  await preparationOnlyAudio(page);
  const downloads: string[] = [];
  page.on('request', (request) => { if (/(local|speaker)\/v[12]\//.test(request.url())) downloads.push(request.url()); });
  await page.goto('/'); expect(downloads).toHaveLength(0); await prepareModels(page);
  const reference = await createGeneratedProfile(page, true);
  const initialDownloads = downloads.length; expect(initialDownloads).toBe(13);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)); await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.name-preparation [role=status]')).toContainText('Ready. Names are estimates;', { timeout: 60000 });
  expect(downloads).toHaveLength(initialDownloads);
  // Deleting the last profile releases automatic inference, retaining its public cache.
  await page.getByRole('button', { name: 'Delete Generated test voice', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete Generated test voice', exact: true }).click();
  await expect(page.getByText('No speakers yet.')).toBeVisible();
  const files = await readdir(new URL('../dist/assets/', import.meta.url));
  const workerFile = files.find((name) => /^local\.worker-.*\.js$/.test(name))!;
  const result = await page.evaluate(async ({ reference, workerFile, localFiles, asr, known, other, command }) => {
    const keys = await caches.keys(); const local = await caches.open(keys.find((key) => key.startsWith('speech-to-text-local:'))!);
    const voice = await caches.open(keys.find((key) => key.startsWith('speech-to-text-model:'))!);
    const assets: Record<string, Uint8Array> = {};
    for (const file of localFiles.filter((file) => !['encoder.onnx', 'decoder.onnx', 'joiner.onnx'].includes(file.name))) assets[file.name] = new Uint8Array(await (await local.match(new URL(`local/v1/${file.name}`, location.href).href))!.arrayBuffer());
    const upgraded = await caches.open(keys.find((key) => key.startsWith('speech-to-text-asr:'))!);
    const encoder = new Uint8Array(asr.encoder.bytes); let at = 0;
    for (const part of asr.encoder.parts) {
      const bytes = new Uint8Array(await (await upgraded.match(new URL(`local/v2/${part.name}`, location.href).href))!.arrayBuffer());
      encoder.set(bytes, at); at += bytes.length;
    }
    assets['encoder.onnx'] = encoder;
    for (const file of asr.files) assets[file.name] = new Uint8Array(await (await upgraded.match(new URL(`local/v2/${file.name}`, location.href).href))!.arrayBuffer());
    assets['embedding.onnx'] = new Uint8Array(await (await voice.match(new URL('speaker/v1/embedding.onnx', location.href).href))!.arrayBuffer());
    const worker = new Worker(`/assets/${workerFile}`, { type: 'module' }); let sequence = 0;
    type Segment = { text: string; speakerId?: string; speakerEstimated?: boolean; isFinal: boolean };
    const request = (data: object) => new Promise<{ segments?: Segment[]; commandStop?: boolean }>((resolve, reject) => {
      const id = ++sequence; worker.onerror = () => reject(new Error('Local worker failed'));
      worker.onmessage = ({ data }) => { if (data.id === id) { if (data.error) reject(new Error(data.error)); else resolve(data); } };
      worker.postMessage({ ...data, id }, 'assets' in data ? Object.values(assets).map((bytes) => bytes.buffer) : []);
    });
    const transcribe = async (speech: number[], clockId: string, voiceCommands = true) => {
      await request({ type: 'start', references: [reference], voiceCommands });
      // A 3-second pause, a new sentence, then 3 seconds to settle the endpoint.
      const samples = new Float32Array(48000 + speech.length + 48000); samples.set(speech, 48000);
      let segments: Segment[] = []; const replacements: number[] = [];
      for (let offset = 0; offset < samples.length; offset += 1600) {
        const response = await request({ type: 'frame', frame: { clockId, startSample: offset, sampleRate: 16000, samples: samples.slice(offset, offset + 1600) } });
        if (response.segments) { segments = response.segments; replacements.push(segments.map((segment) => segment.text).join(' ').length); }
      }
      const final = await request({ type: 'finish' }); segments = final.segments ?? segments; samples.fill(0);
      return { segments, updates: replacements.length };
    };
    try { await request({ type: 'prepare', assets }); return { known: await transcribe(known, 'known'), other: await transcribe(other, 'other'), command: await transcribe(command, 'command', false) }; }
    finally { reference.embedding.fill(0); worker.terminate(); }
  }, { reference, workerFile, localFiles, asr, known: await fixtureSamples('voice-a-speech'), other: await fixtureSamples('voice-b-speech'), command: await fixtureSamples('voice-a-stop') });
  reference.embedding.fill(0);
  expect(result.known.updates).toBeGreaterThan(3);
  expect(result.known.segments.some((segment) => segment.speakerId === 'generated-test' && segment.speakerEstimated)).toBe(true);
  expect(result.known.segments.every((segment) => segment.isFinal)).toBe(true);
  const knownText = result.known.segments.map((segment) => segment.text).join(' ');
  expect(knownText).toContain('morning'); expect(knownText.match(/morning/gi)).toHaveLength(1);
  expect(knownText).not.toBe(knownText.toUpperCase());
  expect(result.other.segments.some((segment) => segment.text)).toBe(true);
  expect(result.other.segments.every((segment) => !segment.speakerId)).toBe(true);
  // In delayed mode only browser recognition handles the user's spoken command.
  expect(result.command.segments.map((segment) => segment.text).join(' ')).toMatch(/command stop/i);
  expect(downloads).toHaveLength(initialDownloads);
  const restored = await createGeneratedProfile(page, true); restored.embedding.fill(0);
  // Simulate a registered installation with only the shared models retained.
  // Automatic startup tries missing files; offline failure remains recoverable.
  await page.evaluate(async () => {
    for (const key of await caches.keys()) if (key.startsWith('speech-to-text-asr:')) await caches.delete(key);
  });
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry names' })).toBeVisible({ timeout: 30000 });
  const repairStart = downloads.length;
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Retry names' }).click();
  await expect(page.locator('.name-preparation [role=status]')).toContainText('Ready. Names are estimates;', { timeout: 60000 });
  expect(downloads.slice(repairStart)).toHaveLength(5);
  expect(downloads.slice(repairStart).every((url) => url.includes('/local/v2/'))).toBe(true);
});

test('Android provisional words receive delayed names and activity filters only the upper pane', async ({ page }) => {
  test.setTimeout(150000);
  await page.goto('/');
  const supported = await page.evaluate(() => Boolean(globalThis.AudioContext && globalThis.AudioWorkletNode));
  test.skip(process.platform === 'win32' && test.info().project.name === 'mobile-webkit' && !supported, 'Windows Playwright WebKit lacks Web Audio; physical Safari remains unverified.');
  expect(supported).toBe(true);
  const speech = await fixtureSamples('voice-a-speech'); const command = await fixtureSamples('voice-a-stop');
  await page.addInitScript(({ speech, command }) => {
    class Recognition {
      onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void;
      start() { Object.assign(window, { delayedBrowserRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { Object.assign(window, { delayedBrowserStopped: true }); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0.0.0 Mobile Safari/537.36' });
    let calls = 0; let stops = 0; const contexts: AudioContext[] = [];
    const NativeAudioContext = globalThis.AudioContext;
    const sources = new WeakMap<MediaStream, { release: () => void }>();
    class FixtureContext extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
      createMediaStreamSource(stream: MediaStream) {
        const fixture = sources.get(stream); if (!fixture) return super.createMediaStreamSource(stream);
        const samples = new Float32Array(48000 + speech.length + 48000 + command.length + 96000);
        samples.set(speech, 48000); samples.set(command, 48000 + speech.length + 48000);
        const source = this.createBufferSource(); source.buffer = this.createBuffer(1, samples.length, 16000);
        source.buffer.copyToChannel(samples, 0); samples.fill(0); source.start();
        fixture.release = () => { source.stop(); source.disconnect(); source.buffer = null; };
        return source as unknown as MediaStreamAudioSourceNode;
      }
    }
    Object.assign(globalThis, { AudioContext: FixtureContext });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      calls++; const destination = contexts.pop()!.createMediaStreamDestination(); const fixture = { release: () => {} };
      sources.set(destination.stream, fixture); const track = destination.stream.getAudioTracks()[0]!; const stop = track.stop.bind(track);
      track.stop = () => { stops++; stop(); fixture.release(); sources.delete(destination.stream); };
      return destination.stream;
    } } });
    Object.assign(window, { localMicrophoneStats: () => ({ calls, stops }) });
  }, { speech, command });
  await page.reload(); await prepareModels(page); const reference = await createGeneratedProfile(page, true); reference.embedding.fill(0);
  const stats = () => page.evaluate(() => (window as Window & { localMicrophoneStats?: () => { calls: number; stops: number } }).localMicrophoneStats?.());
  expect(await stats()).toEqual({ calls: 0, stops: 0 });
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  const transcript = page.getByRole('region', { name: 'Live transcript' });
  const assigned = page.getByRole('region', { name: 'Assigned transcript' });
  const browserText = 'The morning is bright and the room is quiet. Please bring a glass of water to the table.';
  const browserResult = async (stop = false) => page.evaluate(({ text, stop }) => {
    const recognition = (window as Window & { delayedBrowserRecognition?: { onresult(event: unknown): void; onend(): void } }).delayedBrowserRecognition!;
    recognition.onresult({ results: [{ 0: { transcript: stop ? text + ' command stop' : text, confidence: .9 }, length: 1, isFinal: true }] });
    if (stop) recognition.onend();
  }, { text: browserText, stop });
  await browserResult();
  await expect(transcript.locator('p.interim')).toContainText(browserText);
  await expect(transcript.getByText('Generated test voice (estimate)', { exact: true })).toHaveCount(0);
  // Include safe diagnostics if inference fails before a label can render.
  // Only generated fixtures run here; do not print transcript or embeddings.
  let captureStatus: unknown;
  await expect.poll(async () => (captureStatus = {
    known: await assigned.getByText('Generated test voice (estimate)', { exact: true }).first().isVisible(),
    status: await page.locator('#captions > [role=status]').textContent(),
    captionCount: await transcript.locator('.caption').count(),
    microphone: await stats(),
  }), { timeout: 45000 }).toMatchObject({ known: true }).catch((error: unknown) => {
    console.error('Generated capture failure:', JSON.stringify(captureStatus));
    throw error;
  });
  const known = assigned.locator('.caption').filter({ hasText: 'Generated test voice (estimate)' }).first();
  const textColour = await known.locator('p').evaluate((element) => getComputedStyle(element).color);
  expect(textColour).toBe(await known.locator('.caption-speaker').evaluate((element) => getComputedStyle(element).color));
  expect(textColour).not.toBe('rgb(209, 213, 219)'); // Unknown's neutral colour.
  expect(await transcript.locator('p.interim').evaluate((element) => element.firstChild?.textContent)).toBe(browserText);
  await expect(transcript.locator('p.interim')).toHaveCount(1);
  await expect(transcript.locator('.caption-speaker')).toHaveCount(0);
  await expect(assigned).not.toContainText('Unknown speaker');
  // Hiding a reference must not remove it from matching, stop capture or touch live words.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const activity = page.getByRole('button', { name: 'Show Generated test voice in Who said what', exact: true });
  await expect(activity).toHaveAttribute('aria-pressed', 'true'); await activity.click();
  await expect(activity).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(assigned.locator('.caption')).toHaveCount(0);
  await expect(transcript.locator('p.interim')).toContainText(browserText);
  expect(await stats()).toEqual({ calls: 1, stops: 0 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click(); await activity.click();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await expect(known).toBeVisible();
  await page.screenshot({ path: `test-results/two-streams-${test.info().project.name}.png` });
  await browserResult(true);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled({ timeout: 45000 });
  expect(await stats()).toEqual({ calls: 1, stops: 1 });
  expect(await page.evaluate(() => (window as Window & { delayedBrowserStopped?: boolean }).delayedBrowserStopped)).toBe(true);
  await expect(page.locator('#captions > [role=status]')).toHaveText('Stopped by voice command.');
  const text = await transcript.locator('p').allTextContents(); expect(text.join(' ').match(/morning/gi)).toHaveLength(1);
  expect(text.join(' ')).not.toBe(text.join(' ').toUpperCase());
  expect(text.join(' ')).not.toMatch(/COMMAND STOP/i);
  // A second session reuses initialized models; Stop also releases the track.
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect(page.locator('#captions > [role=status]')).toContainText('Listening.');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeEnabled();
  expect(await stats()).toEqual({ calls: 2, stops: 2 });
});

test('automatic model failure offers retry and closing settings does not cancel preparation', async ({ page }) => {
  test.setTimeout(120000);
  await preparationOnlyAudio(page);
  await page.addInitScript(() => {
    const fixture = Object.assign(window, { failNameDownload: true, nameDownloadFailures: 0 });
    const fetchAsset = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (fixture.failNameDownload && url.pathname.endsWith('/local/v2/encoder.part1.bin')) {
        fixture.nameDownloadFailures++; throw new TypeError('Synthetic model download failure.');
      }
      return fetchAsset(input, init);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare voice model' }).click();
  await expect(page.getByRole('button', { name: 'Record 8 seconds' })).toBeVisible({ timeout: 30000 });
  const profile = await createGeneratedProfile(page, true); profile.embedding.fill(0);
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry names' })).toBeVisible({ timeout: 60000 });
  expect(await page.evaluate(() => (window as Window & { nameDownloadFailures?: number }).nameDownloadFailures)).toBeGreaterThan(0);
  await page.evaluate(() => { (window as Window & { failNameDownload?: boolean }).failNameDownload = false; });
  await page.getByRole('button', { name: 'Retry names' }).click();
  await page.getByRole('button', { name: 'Back to captions' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.name-preparation [role=status]')).toContainText('Ready. Names are estimates;', { timeout: 60000 });
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});
