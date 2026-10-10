import { createDiarizer } from './offline-diarization.mjs';
import { readMonoWav } from './asr-streaming.mjs';
import { diarizationFixtures, summarizePlayback } from './diarization-fixtures.mjs';
const root = './private/diarization-runtime/';
const digest = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((v) => v.toString(16).padStart(2, '0')).join('');
async function load(path) {
  const response = await fetch(new URL(path, import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load a prepared research asset.');
  return new Uint8Array(await response.arrayBuffer());
}
self.onmessage = async () => {
  const voices = []; let fixtures = []; let diarizer;
  try {
    self.postMessage({ phase: 'loading' });
    const { default: createModule } = await import(/* @vite-ignore */ `${root}diarization-runtime.mjs`);
    const wasm = await load(`${root}diarization-runtime.wasm`);
    const segmentation = await load(`${root}model.int8.onnx`);
    if (await digest(segmentation) !== 'd582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d') throw new Error('Segmentation checksum mismatch.');
    const embedding = await load('../public/speaker/v1/embedding.onnx');
    for (const name of ['Hazel', 'Zira']) voices.push(readMonoWav(await load(`${root}${name}.wav`)));
    fixtures = diarizationFixtures(...voices);
    const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
    const started = performance.now(); diarizer = createDiarizer(module, segmentation, embedding);
    const report = { initializationMs: Math.round(performance.now() - started), numClusters: -1, clusteringDistanceThreshold: 0.5, runs: [] };
    for (const fixture of fixtures) {
      self.postMessage({ phase: 'processing', fixture: fixture.name });
      const start = performance.now(); const result = diarizer.process(fixture.audio);
      report.runs.push({ fixture: fixture.name, inputSeconds: fixture.audio.length / 16000,
        elapsedMs: Math.round(performance.now() - start), wasmLinearMemoryBytes: module.HEAPU8.length,
        ...result, ...summarizePlayback(result.segments, fixture.playback) });
    }
    self.postMessage({ phase: 'complete', report });
  } catch (error) { self.postMessage({ phase: 'error', message: error instanceof Error ? error.message : 'Diarization failed.' }); }
  finally {
    diarizer?.close(); for (const voice of voices) voice.fill(0); for (const fixture of fixtures) fixture.audio.fill(0);
  }
};
