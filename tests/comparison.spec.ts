import { expect, test } from '@playwright/test';
import model from '../speaker-assets.json' with { type: 'json' };

test('separate comparison page keeps one evolving live sentence and connection details in Settings', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void;
      start() { Object.assign(window, { comparisonRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); } abort() {}
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/compare.html');
  await expect(page).toHaveTitle('Speech to Text — PC comparison');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  for (const transcript of ['The sentence', 'The sentence grows', 'The sentence grows once.']) {
    await page.evaluate((text) => {
      const host = window as Window & { comparisonRecognition?: { onresult: (event: unknown) => void } };
      host.comparisonRecognition?.onresult({ results: [{ 0: { transcript: text, confidence: .9 }, length: 1, isFinal: false }] });
    }, transcript);
  }
  const live = page.getByRole('region', { name: 'Live transcript' });
  await expect(live.locator('.caption')).toHaveCount(1);
  await expect(live).toContainText('The sentence grows once.');
  await expect(live.locator('.caption-speaker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Service address')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open original app' })).toHaveAttribute('href', './');
  await expect(page.getByRole('heading', { name: 'Add a speaker' })).toBeVisible();
});

test('project-path comparison consumes private fragment without leaking it to requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await page.goto('http://127.0.0.1:4174/speech-to-text/compare.html#service=https%3A%2F%2Fexample.test&key=synthetic-access-code');
  await expect(page).toHaveURL('http://127.0.0.1:4174/speech-to-text/compare.html');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Service address')).toHaveValue('https://example.test');
  await expect(page.getByLabel('Access code')).toHaveValue('synthetic-access-code');
  expect(requests.some((url) => url.includes('synthetic-access-code') || url.includes('example.test'))).toBe(false);
  await page.evaluate(() => { location.hash = 'service=https%3A%2F%2Fupdated.test&key=replacement-code'; });
  await expect(page.getByLabel('Service address')).toHaveValue('https://updated.test');
  await expect(page).toHaveURL('http://127.0.0.1:4174/speech-to-text/compare.html');
});

test('comparison flushes real worklet capture on voice Stop and names only the upper pane', async ({ page }) => {
  await page.goto('/compare.html');
  const supported = await page.evaluate(() => Boolean(globalThis.AudioContext && globalThis.AudioWorkletNode));
  test.skip(process.platform === 'win32' && test.info().project.name === 'mobile-webkit' && !supported, 'Windows WebKit lacks Web Audio; physical Safari remains untested.');
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void; onend?: () => void; onresult?: (event: unknown) => void;
      start() { Object.assign(window, { comparisonRecognition: this }); this.onstart?.(); }
      stop() { this.onend?.(); } abort() {}
    }
    const NativeContext = AudioContext; const contexts: AudioContext[] = []; let stopped = 0;
    class Context extends NativeContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
      createMediaStreamSource() {
        const source = this.createOscillator(); source.start();
        return source as unknown as MediaStreamAudioSourceNode;
      }
    }
    Object.assign(window, { SpeechRecognition: Recognition, AudioContext: Context, comparisonStopped: () => stopped });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
      const stream = contexts.at(-1)!.createMediaStreamDestination().stream;
      const track = stream.getAudioTracks()[0]!; const stop = track.stop.bind(track);
      track.stop = () => { stopped++; stop(); }; return stream;
    } } });
  });
  await page.evaluate(async (modelVersion) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('speech-to-text-speakers:/', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('profiles', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = db.transaction('profiles', 'readwrite'); transaction.oncomplete = () => resolve();
      transaction.objectStore('profiles').put({ schemaVersion: 1, id: 'synthetic', displayName: 'Example', registrationMethod: 'record-button',
        createdAt: new Date().toISOString(), modelVersion, sampleDurationMs: 20000, embedding: [1, ...Array(191).fill(0)] });
    }); db.close();
  }, model.version);
  let uploads = 0;
  await page.route('https://comparison.test/**', async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (route.request().url().endsWith('/health')) { await route.fulfill({ json: { protocol: 1 }, headers }); return; }
    const payload = route.request().postDataJSON(); uploads++;
    expect(payload.profiles[0].id).toBe('synthetic'); expect(payload.profiles[0]).not.toHaveProperty('displayName');
    expect(Buffer.from(payload.pcm, 'base64').length).toBeGreaterThan(16000);
    await route.fulfill({ headers, json: { index: payload.index, processingMs: 1,
      words: [{ text: 'Complete.', start: .1, end: .3, speakerId: 'synthetic' }, { text: 'Unknown.', start: .4, end: .5 }] } });
  });
  await page.goto('/compare.html?capture-test=1#service=https%3A%2F%2Fcomparison.test&key=synthetic-test-code');
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await page.waitForTimeout(1500); // Collect >0.5 s on the real audio-worklet clock.
  await page.evaluate(() => {
    const host = window as Window & { comparisonRecognition?: { onresult: (event: unknown) => void } };
    host.comparisonRecognition?.onresult({ results: [{ 0: { transcript: 'Complete. command stop', confidence: .9 }, length: 1, isFinal: true }] });
  });
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Assigned transcript' })).toContainText('Example (estimate)');
  await expect(page.getByRole('region', { name: 'Assigned transcript' })).not.toContainText('Unknown.');
  await expect(page.getByRole('region', { name: 'Live transcript' })).toContainText('Complete.');
  await expect(page.getByRole('region', { name: 'Live transcript' }).locator('.caption-speaker')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { comparisonStopped?: () => number }).comparisonStopped?.())).toBe(1);
  expect(uploads).toBe(1);
});
