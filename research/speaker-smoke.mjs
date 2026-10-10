import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createExtractor, syntheticAudio } from './speaker-inference.mjs';

const folder = new URL('./private/speaker-runtime/', import.meta.url);
const [wasm, model] = await Promise.all([readFile(new URL('speaker-runtime.wasm', folder)), readFile(new URL(process.argv[2] ?? 'embedding.onnx', folder))]);
const { default: createModule } = await import(new URL('speaker-runtime.mjs', folder).href);
const started = performance.now();
const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
const runtimeMs = performance.now() - started;
const loading = performance.now();
const extractor = await createExtractor(module, model);
const modelLoadMs = performance.now() - loading;
const samples = syntheticAudio();
const runs = [];
try {
  for (let i = 0; i < 3; i++) {
    const before = performance.now();
    const embedding = extractor.compute(samples);
    const inferenceMs = performance.now() - before;
    const norm = Math.hypot(...embedding);
    if (!Number.isFinite(norm) || norm === 0) throw new Error('Embedding has invalid norm.');
    runs.push({ inferenceMs: Math.round(inferenceMs), wasmMemoryBytes: module.HEAPU8.byteLength, dimension: embedding.length, finiteNonzero: true });
    embedding.fill(0);
  }
} finally { samples.fill(0); extractor.close(); }
console.log(JSON.stringify({
  runtime: process.version, platform: process.platform, signal: 'synthetic-3-seconds-not-speech',
  modelSha256: createHash('sha256').update(model).digest('hex'),
  wasmSha256: createHash('sha256').update(wasm).digest('hex'),
  runtimeMs: Math.round(runtimeMs), modelLoadMs: Math.round(modelLoadMs), runs,
  speakerAccuracyMeasured: false,
}, null, 2));
