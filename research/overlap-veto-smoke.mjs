import { readFile } from 'node:fs/promises';
import { createDiarizer } from './offline-diarization.mjs';
import { readMonoWav } from './asr-streaming.mjs';
import { diarizationFixtures } from './diarization-fixtures.mjs';
const root = new URL('./private/diarization-runtime/', import.meta.url);
const { default: createModule } = await import(new URL('diarization-runtime.mjs', root));
const module = await createModule({ wasmBinary: await readFile(new URL('diarization-runtime.wasm', root)), print: () => {}, printErr: () => {} });
const diarizer = createDiarizer(module, await readFile(new URL('model.int8.onnx', root)), await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url)));
const a = readMonoWav(await readFile(new URL('./private/attribution-fixtures/Hazel-heldout.wav', import.meta.url)));
const b = readMonoWav(await readFile(new URL('./private/attribution-fixtures/Zira-heldout.wav', import.meta.url)));
try {
  for (const amplitude of [1, .2]) {
    const scaled = Float32Array.from(b, (v) => v * amplitude);
    const fixtures = diarizationFixtures(a, scaled); scaled.fill(0);
    const fixture = fixtures.find((f) => f.name === 'overlap-A-B');
    for (const seconds of [process.argv.includes('--short') ? 5 : 10]) {
      const windows = [];
      for (let end = seconds * 16000; end <= fixture.audio.length; end += 24000) {
        const start = end - seconds * 16000; const began = performance.now();
        const result = diarizer.process(fixture.audio.subarray(start, end));
        const overlaps = [];
        for (let i = 0; i < result.segments.length; i++) for (let j = i + 1; j < result.segments.length; j++) {
          const left = result.segments[i], right = result.segments[j];
          const from = Math.max(left.start, right.start), to = Math.min(left.end, right.end);
          if (left.cluster !== right.cluster && to > from) overlaps.push([from + start / 16000, to + start / 16000]);
        }
        windows.push({ end: end / 16000, processingMs: Math.round(performance.now() - began), overlaps });
      }
      console.log(JSON.stringify({ amplitude, seconds, windows }));
    }
    fixtures.forEach((f) => f.audio.fill(0));
  }
} finally { diarizer.close(); a.fill(0); b.fill(0); }
