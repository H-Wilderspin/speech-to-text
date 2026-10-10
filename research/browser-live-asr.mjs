import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
const pipelineMode = process.argv.includes('--pipeline');
const url = process.env.LIVE_ASR_URL ?? `http://localhost:5178/research/live-asr.html${pipelineMode ? '?pipeline=1' : ''}`;
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage(); await page.goto(url);
    const supported = await page.evaluate(() => Boolean(globalThis.AudioContext && globalThis.AudioWorkletNode));
    if (!supported && process.platform === 'win32' && name === 'webkit') {
      assert.match(await page.locator('#status').innerText(), /cannot capture/);
      console.log('Windows WebKit: unsupported Web Audio fallback verified; capture tests skipped.'); continue;
    }
    assert(supported, 'This browser must support Web Audio for the capture test.');
    await page.addInitScript(() => {
      let calls = 0; let stops = 0; let closed = 0;
      Object.assign(window, { captureStats: () => ({ calls, stops, closed }) });
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
        calls++;
        if (window.denyMicrophone) throw new DOMException('Denied', 'NotAllowedError');
        // Exercise continuous native resampling from a 48 kHz source into the
        // capture context at 16 kHz. Only this generated fixture is read.
        const context = new AudioContext({ sampleRate: 48000 }); await context.resume();
        const source = context.createBufferSource();
        source.buffer = await context.decodeAudioData(await (await fetch('/research/private/asr-runtime/synthetic.wav')).arrayBuffer());
        const destination = context.createMediaStreamDestination(); source.connect(destination);
        source.start(context.currentTime + 1);
        const track = destination.stream.getAudioTracks()[0]; const nativeStop = track.stop.bind(track);
        track.stop = () => { stops++; nativeStop(); source.stop(); void context.close().then(() => closed++); };
        if (window.delayPermission) await new Promise((resolve) => { window.resolvePermission = resolve; });
        return destination.stream;
      } } });
    });
    const prepare = async () => {
      await page.getByRole('button', { name: 'Prepare local ASR' }).click();
      await page.getByText('Ready. Tap Listen locally.', { exact: true }).waitFor({ timeout: 60000 });
    };
    await page.reload(); await prepare();
    assert.deepEqual(await page.evaluate(() => window.captureStats()), { calls: 0, stops: 0, closed: 0 });
    await page.getByRole('button', { name: 'Listen locally' }).click();
    await page.waitForFunction(() => {
      const text = document.querySelector('#report').textContent;
      return text && JSON.parse(text).acceptedSamples >= 160000;
    }, null, { timeout: 20000 });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByText('Complete. Microphone stopped.', { exact: true }).waitFor();
    const report = JSON.parse(await page.locator('#report').innerText());
    assert(report.hasText); assert(report.chunks >= 100); assert.equal(report.sampleRate, 16000);
    if (pipelineMode) { assert(report.speechRegionCount > 0); assert(report.windowCount > 0); assert.equal(report.singleSpeakerVerified, false); }
    await page.waitForFunction(() => window.captureStats().closed === 1);
    assert.deepEqual(await page.evaluate(() => window.captureStats()), { calls: 1, stops: 1, closed: 1 });
    console.log(JSON.stringify({ engine: name, version: browser.version(), fixture: 'generated-speech-through-continuous-capture', ...report }));

    await page.reload(); await page.evaluate(() => { window.denyMicrophone = true; }); await prepare();
    await page.getByRole('button', { name: 'Listen locally' }).click();
    await page.getByText('Microphone access was denied.', { exact: false }).waitFor();

    await page.reload(); await page.evaluate(() => { window.delayPermission = true; }); await prepare();
    await page.getByRole('button', { name: 'Listen locally' }).click();
    await page.waitForFunction(() => typeof window.resolvePermission === 'function');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => window.resolvePermission());
    await page.waitForFunction(() => window.captureStats().closed === 1);
    assert.equal((await page.evaluate(() => window.captureStats())).stops, 1);

    await page.reload(); await prepare(); await page.getByRole('button', { name: 'Listen locally' }).click();
    await page.getByText('Listening locally.', { exact: true }).waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.getByText('Interrupted. Microphone stopped.', { exact: true }).waitFor();
    await page.waitForFunction(() => window.captureStats().closed === 1);

    await page.reload();
    await page.evaluate(() => {
      const OriginalWorker = Worker;
      window.Worker = class extends OriginalWorker {
        postMessage(message, transfer) { if (message.type !== 'frame') super.postMessage(message, transfer); }
      };
    });
    await prepare(); await page.getByRole('button', { name: 'Listen locally' }).click();
    await page.getByText('Audio processing could not keep up.', { exact: false }).waitFor({ timeout: 10000 });
    await page.waitForFunction(() => window.captureStats().closed === 1);
    assert.equal((await page.evaluate(() => window.captureStats())).stops, 1);
    console.log(`${name}: permission denial, late permission cancellation, pagehide and bounded consumer stall passed.`);
  } finally { await browser.close(); }
}
