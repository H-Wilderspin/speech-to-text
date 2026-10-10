import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createDiarizer } from './offline-diarization.mjs';
import { readMonoWav } from './asr-streaming.mjs';
import { diarizationFixtures, summarizePlayback } from './diarization-fixtures.mjs';

const root = new URL('./private/diarization-runtime/', import.meta.url);
const { default: createModule } = await import(new URL('diarization-runtime.mjs', root));
const wasm = await readFile(new URL('diarization-runtime.wasm', root));
const segmentation = await readFile(new URL('model.int8.onnx', root));
assert.equal(createHash('sha256').update(segmentation).digest('hex'), 'd582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d');
const embedding = await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url));
const voices = [];
for (const name of ['Hazel', 'Zira']) voices.push(readMonoWav(await readFile(new URL(`${name}.wav`, root))));
const fixtures = diarizationFixtures(...voices);
try {
  const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
  const start = performance.now(); const diarizer = createDiarizer(module, segmentation, embedding);
  console.log(JSON.stringify({ runtime: process.version, wasmBytes: wasm.length, wasmSha256: createHash('sha256').update(wasm).digest('hex'),
    initializationMs: Math.round(performance.now() - start), numClusters: -1, clusteringDistanceThreshold: 0.5, windowShiftRatio: 0.1 }));
  try {
    for (const fixture of fixtures) {
      const started = performance.now(); const result = diarizer.process(fixture.audio);
      if (fixture.name === 'silence') assert.equal(result.segments.length, 0);
      console.log(JSON.stringify({ fixture: fixture.name, inputSeconds: fixture.audio.length / 16000,
        elapsedMs: Math.round(performance.now() - started), wasmLinearMemoryBytes: module.HEAPU8.length,
        ...result, ...summarizePlayback(result.segments, fixture.playback) }));
    }
  } finally { diarizer.close(); }
} finally {
  for (const samples of voices) samples.fill(0);
  for (const fixture of fixtures) fixture.audio.fill(0);
}
