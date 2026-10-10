import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { cosine } from '../src/identification/similarity.ts';
import { readMonoWav } from './asr-streaming.mjs';
import { loadPipelineRuntime } from './node-pipeline.mjs';
import { createExtractor } from './speaker-inference.mjs';
import { createSharedPipeline } from './shared-pipeline.mjs';
import { diarizationFixtures } from './diarization-fixtures.mjs';
import { attributeTokenPoint } from './token-attribution.mjs';

// Generated voices only. Synthetic calibration is NEVER a production threshold.
const { module, createOnlineRecognizer, assets } = await loadPipelineRuntime();
const root = new URL('./private/attribution-fixtures/', import.meta.url);
const voices = ['Hazel', 'Zira']; const audio = []; const references = [];
const extractor = await createExtractor(module, assets['embedding.onnx']);
const rank = (embedding) => references.map((reference, index) => ({ id: ['A', 'B'][index], score: cosine(embedding, reference) }))
  .sort((a, b) => b.score - a.score);
const calibration = [];
try {
  for (const voice of voices) {
    const files = {};
    for (const kind of ['profile', 'calibration', 'heldout']) files[kind] = readMonoWav(await readFile(new URL(`${voice}-${kind}.wav`, root)));
    audio.push(files); references.push(extractor.compute(files.profile));
  }
  for (let voice = 0; voice < voices.length; voice++) {
    const samples = audio[voice].calibration;
    for (let start = 0; start + 48000 <= samples.length; start += 24000) {
      const embedding = extractor.compute(samples.subarray(start, start + 48000));
      try {
        const scores = rank(embedding); const own = scores.find((s) => s.id === ['A', 'B'][voice]).score;
        const other = scores.find((s) => s.id !== ['A', 'B'][voice]).score;
        calibration.push({ own, other, margin: own - other });
      } finally { embedding.fill(0); }
    }
  }
} finally { extractor.close(); }
const minimumOwn = Math.min(...calibration.map((r) => r.own));
const maximumOther = Math.max(...calibration.map((r) => r.other));
const minimumMargin = Math.min(...calibration.map((r) => r.margin));
const separable = minimumOwn > maximumOther && minimumMargin > 0;
const scoreGate = separable ? (minimumOwn + maximumOther) / 2 : 1;
const marginGate = separable ? minimumMargin / 2 : 2;
const reports = [];
try {
  const fixtures = diarizationFixtures(audio[0].heldout, audio[1].heldout);
  const a = audio[0].heldout; const b = audio[1].heldout;
  const gapless = new Float32Array(32000 + a.length * 2 + b.length);
  gapless.set(a, 16000); gapless.set(b, 16000 + a.length); gapless.set(a, 16000 + a.length + b.length);
  fixtures.push({ name: 'gapless-A-B-A', audio: gapless, playback: [
    { voice: 'A', start: 1, end: 1 + a.length / 16000 },
    { voice: 'B', start: 1 + a.length / 16000, end: 1 + (a.length + b.length) / 16000 },
    { voice: 'A', start: 1 + (a.length + b.length) / 16000, end: 1 + (a.length * 2 + b.length) / 16000 },
  ] });
  const quietB = Float32Array.from(b, (value) => value * .2);
  const unequalOverlap = diarizationFixtures(a, quietB).find((f) => f.name === 'overlap-A-B');
  unequalOverlap.name = 'overlap-quiet-B'; fixtures.push(unequalOverlap); quietB.fill(0);
  const unknown = new Float32Array(b.length + 32000); unknown.set(b, 16000);
  fixtures.push({ name: 'unenrolled-B', audio: unknown, playback: [{ voice: 'B', start: 1, end: 1 + b.length / 16000 }] });
  for (const fixture of fixtures) {
    const windows = []; const tokens = []; let maxFrameMs = 0;
    const pipeline = await createSharedPipeline(module, createOnlineRecognizer, assets, () => {}, { windowGate: 'energy', inspectEmbedding: (window) => {
      const scores = rank(window.embedding).filter((s) => fixture.name !== 'unenrolled-B' || s.id === 'A');
      const winner = scores[0]; const margin = scores[1] ? winner.score - scores[1].score : 2;
      windows.push({ clockId: window.clockId, startSample: window.startSample, endSample: window.endSample,
        speakerId: separable && winner.score >= scoreGate && margin >= marginGate ? winner.id : undefined,
        winner: winner.id, score: winner.score, margin });
    } });
    const started = performance.now();
    try {
      for (let offset = 0; offset < fixture.audio.length; offset += 1600) {
        const result = pipeline.accept({ clockId: fixture.name, sampleRate: 16000, startSample: offset, samples: fixture.audio.subarray(offset, offset + 1600) });
        maxFrameMs = Math.max(maxFrameMs, result.processingMs);
        if (result.isFinal) tokens.push(...result.tokenPoints);
      }
      tokens.push(...pipeline.finish().tokenPoints);
      const counts = { correctlyNamed: 0, incorrectlyNamed: 0, unknown: 0, overlapNamed: 0, outsidePlayback: 0 };
      for (const token of tokens) {
        const attribution = attributeTokenPoint({ ...token, clockId: fixture.name }, windows, fixture.audio.length, true);
        const id = attribution.speakerId;
        const expected = [...new Set(fixture.playback.filter((p) => p.start * 16000 <= token.sample && p.end * 16000 > token.sample).map((p) => p.voice))];
        if (!expected.length) counts.outsidePlayback++;
        else if (!id) counts.unknown++;
        else if (expected.length > 1) counts.overlapNamed++;
        else if (id === expected[0]) counts.correctlyNamed++;
        else counts.incorrectlyNamed++;
      }
      if (fixture.name === 'silence') assert.equal(windows.length, 0);
      reports.push({ fixture: fixture.name, inputSeconds: fixture.audio.length / 16000, processingMs: Math.round(performance.now() - started),
        maxFrameMs: Math.round(maxFrameMs), tokens: tokens.length, counts,
        windowCount: windows.length,
        ...(process.argv.includes('--verbose') ? { windows: windows.map((w) => ({ start: w.startSample / 16000, end: w.endSample / 16000, speaker: w.speakerId ?? 'Unknown',
          score: Number(w.score.toFixed(3)), margin: Number(w.margin.toFixed(3)) })) } : {}) });
    } finally { pipeline.close(); fixture.audio.fill(0); }
  }
} finally { audio.forEach((files) => Object.values(files).forEach((samples) => samples.fill(0))); references.forEach((v) => v.fill(0)); }
console.log(JSON.stringify({ experiment: 'generated-voice-reference-windows', humanAccuracyMeasured: false,
  syntheticCalibrationOnly: { count: calibration.length, separable, minimumOwn, maximumOther, minimumMargin, scoreGate, marginGate }, reports }, null, 2));
