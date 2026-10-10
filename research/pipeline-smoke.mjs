import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSharedPipeline } from './shared-pipeline.mjs';
import { readMonoWav } from './asr-streaming.mjs';
const root = new URL('./private/pipeline-runtime/', import.meta.url);
const asrRoot = new URL('./private/asr-runtime/', import.meta.url);
const { default: createModule } = await import(new URL('pipeline-runtime.mjs', root));
const { createOnlineRecognizer } = await import(new URL('asr-api.cjs', asrRoot));
const wasm = await readFile(new URL('pipeline-runtime.wasm', root));
const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
const assets = {};
for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) assets[name] = await readFile(new URL(name, asrRoot));
assets['silero_vad.onnx'] = await readFile(new URL('silero_vad.onnx', root));
assets['embedding.onnx'] = await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url));
const speech = readMonoWav(await readFile(new URL('synthetic.wav', asrRoot)));
const sequence = new Float32Array(speech.length * 2 + 16000 * 7);
sequence.set(speech, 16000); sequence.set(speech, speech.length + 16000 * 4);
const repeated = new Float32Array(16000 * 24);
for (let offset = 0; offset < repeated.length; offset += 16000) repeated.set(speech.subarray(16000, 32000), offset);
const reports = [];
try {
  for (const [name, samples] of [['silence', new Float32Array(16000 * 3)], ['two-separated-phrases', sequence], ['continuous-repeated-fragment', repeated]]) {
    const initialization = performance.now();
    const pipeline = await createSharedPipeline(module, createOnlineRecognizer, assets, (region) => {
      assert.deepEqual(region.samples, samples.subarray(region.startSample, region.endSample), 'Region must contain the exact input-clock samples.');
    });
    const modelMs = performance.now() - initialization; const started = performance.now();
    let maxFrameMs = 0; let firstTextAtSamples = null; const regions = []; const windows = [];
    try {
      for (let offset = 0; offset < samples.length; offset += 1600) {
        const response = pipeline.accept({ clockId: name, sampleRate: 16000, startSample: offset, samples: samples.subarray(offset, offset + 1600) });
        if (response.text.trim() && firstTextAtSamples === null) firstTextAtSamples = response.acceptedSamples;
        regions.push(...response.regions); maxFrameMs = Math.max(maxFrameMs, response.processingMs);
        windows.push(...response.windows);
      }
      const tail = pipeline.finish(); regions.push(...tail.regions);
      if (name === 'silence') { assert.equal(regions.length, 0); assert.equal(windows.length, 0); }
      if (name === 'two-separated-phrases') assert(regions.length >= 2);
      if (name === 'continuous-repeated-fragment') assert(regions.some((region) => region.reason === 'window-limit'));
      reports.push({ fixture: name, inputSeconds: samples.length / 16000, modelMs: Math.round(modelMs), elapsedMs: Math.round(performance.now() - started),
        maxFrameMs: Math.round(maxFrameMs), firstTextAtSamples, wasmLinearMemoryBytes: module.HEAPU8.length, unclassifiedTailSamples: tail.unclassifiedTailSamples,
        exactRegionSamplesVerified: true, exactWindowSamplesVerified: true, regions,
        windowCount: windows.length, maxEmbeddingMs: Math.round(Math.max(0, ...windows.map((window) => window.embeddingMs))),
        embeddingDimensions: [...new Set(windows.map((window) => window.embeddingDimension))] });
    } finally { pipeline.close(); samples.fill(0); }
  }
  assert(reports.some((report) => report.embeddingDimensions.includes(192)));
  console.log(JSON.stringify({ wasmBytes: wasm.length, wasmSha256: createHash('sha256').update(wasm).digest('hex'), reports }, null, 2));
} finally { speech.fill(0); sequence.fill(0); repeated.fill(0); }
