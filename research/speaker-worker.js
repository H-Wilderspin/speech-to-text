// Deliberately outside src/public: this experiment is not part of the deployed app.
let running = false;
self.onmessage = async () => {
  if (running) return;
  running = true;
  let extractor; let samples;
  const started = performance.now();
  try {
    const root = new URL('./private/speaker-runtime/', self.location.href);
    postMessage({ type: 'progress', message: 'Loading the local research runtime and model…' });
    const [api, wasmResponse, modelResponse] = await Promise.all([
      import(/* @vite-ignore */ new URL('./speaker-inference.mjs', self.location.href).href),
      fetch(new URL('speaker-runtime.wasm', root), { cache: 'no-store' }),
      fetch(new URL('embedding.onnx', root), { cache: 'no-store' }),
    ]);
    if (!wasmResponse.ok || !modelResponse.ok) throw new Error('Research assets are missing. Build the speaker runtime and extract the model first.');
    const [wasm, modelBuffer] = await Promise.all([wasmResponse.arrayBuffer(), modelResponse.arrayBuffer()]);
    const { default: createSpeakerModule } = await import(/* @vite-ignore */ new URL('speaker-runtime.mjs', root).href);
    const runtimeStarted = performance.now();
    const module = await createSpeakerModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
    const runtimeMs = performance.now() - runtimeStarted;
    const loadStarted = performance.now();
    extractor = await api.createExtractor(module, new Uint8Array(modelBuffer));
    const modelLoadMs = performance.now() - loadStarted;
    samples = api.syntheticAudio();
    const runs = [];
    for (let index = 0; index < 3; index++) {
      postMessage({ type: 'progress', message: `Computing synthetic embedding ${index + 1} of 3…` });
      const before = performance.now();
      const embedding = extractor.compute(samples);
      const inferenceMs = performance.now() - before;
      const norm = Math.hypot(...embedding);
      if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid model output.');
      runs.push({ inferenceMs: Math.round(inferenceMs), wasmMemoryBytes: module.HEAPU8.byteLength, dimension: embedding.length, finiteNonzero: true });
      embedding.fill(0);
    }
    postMessage({ type: 'complete', report: {
      userAgent: navigator.userAgent, signal: 'synthetic-3-seconds-not-speech',
      runtimeMs: Math.round(runtimeMs), modelLoadMs: Math.round(modelLoadMs),
      totalMs: Math.round(performance.now() - started), runs, speakerAccuracyMeasured: false,
    } });
  } catch (error) {
    postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Speaker experiment failed.' });
  } finally {
    samples?.fill(0); extractor?.close(); running = false;
  }
};
