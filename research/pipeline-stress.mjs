import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { loadPipelineRuntime } from './node-pipeline.mjs';
import { createSharedPipeline } from './shared-pipeline.mjs';
import { readMonoWav } from './asr-streaming.mjs';

const { module, createOnlineRecognizer, assets } = await loadPipelineRuntime();
const speech = readMonoWav(await readFile(new URL('./private/asr-runtime/synthetic.wav', import.meta.url)));
const minutes = Number(process.argv[2] ?? 15);
if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) throw new Error('Choose 1–30 minutes of generated input.');
const totalSamples = 16000 * 60 * minutes; const cycleSamples = speech.length + 16000 * 3;
const fill = (samples, startSample) => {
  for (let i = 0; i < samples.length; i++) {
    const source = startSample + i - 16000;
    const cycle = source % cycleSamples;
    samples[i] = source < 0 || cycle >= speech.length ? 0 : speech[cycle];
  }
  return samples;
};
let verifiedSlices = 0;
const pipeline = await createSharedPipeline(module, createOnlineRecognizer, assets, (region) => {
  const expected = fill(new Float32Array(region.samples.length), region.startSample);
  try { assert.deepEqual(region.samples, expected, 'Every slice must retain its original sample coordinates.'); verifiedSlices++; }
  finally { expected.fill(0); }
});
const frame = new Float32Array(1600); const started = performance.now();
let regionCount = 0; let windowCount = 0; let finalCount = 0; let maxFrameMs = 0;
let lastRegionEnd = 0; let lastFinalToken = 0; let lastWindowEnd = 0;
const checkpoints = [];
const inspect = (response) => {
  assert.equal(response.clockId, 'generated-stress-stream');
  maxFrameMs = Math.max(maxFrameMs, response.processingMs);
  for (const region of response.regions) {
    assert(region.startSample >= lastRegionEnd && region.endSample <= response.acceptedSamples);
    lastRegionEnd = region.endSample; regionCount++;
  }
  for (const window of response.windows) {
    assert(window.endSample > lastWindowEnd && window.endSample <= response.acceptedSamples);
    assert.equal(window.endSample - window.startSample, 48000); assert.equal(window.embeddingDimension, 192);
    lastWindowEnd = window.endSample; windowCount++;
  }
  if (response.isFinal && response.timing.tokenCount) {
    assert(response.timing.firstTokenSeconds >= lastFinalToken, 'Final ASR segments must stay on the increasing session clock.');
    lastFinalToken = response.timing.lastTokenSeconds; finalCount++;
  }
};
try {
  for (let startSample = 0; startSample < totalSamples; startSample += frame.length) {
    fill(frame, startSample);
    inspect(pipeline.accept({ clockId: 'generated-stress-stream', sampleRate: 16000, startSample, samples: frame }));
    frame.fill(0);
    if ((startSample + frame.length) % (16000 * 60) === 0) {
      const memory = process.memoryUsage();
      const checkpoint = { inputMinutes: (startSample + frame.length) / (16000 * 60), elapsedMs: Math.round(performance.now() - started),
        wasmLinearMemoryBytes: module.HEAPU8.length, sampledNodeRssBytes: memory.rss, sampledJsHeapBytes: memory.heapUsed,
        regionCount, windowCount, finalCount, maxFrameMs: Math.round(maxFrameMs) };
      checkpoints.push(checkpoint); console.log(JSON.stringify({ checkpoint }));
      await new Promise(setImmediate);
    }
  }
  const tail = pipeline.finish(); inspect(tail);
  assert.equal(tail.acceptedSamples, totalSamples); assert(finalCount > minutes * 2 && regionCount > minutes * 2 && windowCount > minutes * 5);
  console.log(JSON.stringify({ complete: true, generatedAudioOnly: true, realTimePaced: false, inputSeconds: totalSamples / 16000,
    elapsedMs: Math.round(performance.now() - started), verifiedSlices, regionCount, windowCount, finalCount,
    maxFrameMs: Math.round(maxFrameMs), unclassifiedTailSamples: tail.unclassifiedTailSamples,
    wasmMemoryAtFirstMinute: checkpoints[0].wasmLinearMemoryBytes, wasmMemoryAtLastMinute: checkpoints.at(-1).wasmLinearMemoryBytes }));
} finally { frame.fill(0); speech.fill(0); pipeline.close(); }
