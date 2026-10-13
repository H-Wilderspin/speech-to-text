import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { platform, release, cpus } from 'node:os';
import { cosine } from '../src/identification/similarity.ts';
import { readMonoWav } from './asr-streaming.mjs';
import { createSharedPipeline } from './shared-pipeline.mjs';
import { createExtractor } from './speaker-inference.mjs';
import { createDiarizer } from './offline-diarization.mjs';
import { attributeTokenPoint } from './token-attribution.mjs';
import { timelineIdentity } from './comparison-metrics.mjs';

const root = new URL('./private/comparison/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const publicRoot = new URL('../public/local/v1/', import.meta.url);
const { default: createModule } = await import(new URL('pipeline-runtime.mjs', publicRoot));
// Public browser wrapper has a Node/CommonJS branch plus its ESM export.
// Use a private .cjs copy with only that final ESM export removed.
const asrSource = await readFile(new URL('asr-api.mjs', publicRoot), 'utf8');
await writeFile(new URL('asr-api.cjs', root), asrSource.replace('export { createOnlineRecognizer };', ''));
const { createOnlineRecognizer } = await import(new URL('asr-api.cjs', root));
const assets = {}; const hashes = {};
for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt', 'silero_vad.onnx', 'pipeline-runtime.wasm']) {
  assets[name] = await readFile(new URL(name, publicRoot)); hashes[name] = createHash('sha256').update(assets[name]).digest('hex');
}
assets['embedding.onnx'] = await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url));
hashes['embedding.onnx'] = createHash('sha256').update(assets['embedding.onnx']).digest('hex');
const started = performance.now();
const module = await createModule({ wasmBinary: assets['pipeline-runtime.wasm'], print: () => {}, printErr: () => {} });
const extractor = await createExtractor(module, assets['embedding.onnx']);
const references = {};
for (const voice of ['Hazel', 'Zira']) references[voice] = extractor.compute(readMonoWav(await readFile(new URL(`${voice}-profile.wav`, root))));
const diarRoot = new URL('./private/diarization-runtime/', import.meta.url);
const { default: createDiarModule } = await import(new URL('diarization-runtime.mjs', diarRoot));
const diarWasm = await readFile(new URL('diarization-runtime.wasm', diarRoot));
const segmentation = await readFile(new URL('model.int8.onnx', diarRoot));
hashes['segmentation.onnx'] = createHash('sha256').update(segmentation).digest('hex');
hashes['diarization-runtime.wasm'] = createHash('sha256').update(diarWasm).digest('hex');
const diarModule = await createDiarModule({ wasmBinary: diarWasm, print: () => {}, printErr: () => {} });
const diarizer = createDiarizer(diarModule, segmentation, assets['embedding.onnx']);
const report = { synthetic: true, baseline: 'production local ASR and window rule, before browser text correspondence; not end-to-end app',
  host: { platform: platform(), release: release(), cpu: cpus()[0].model, node: process.version }, hashes,
  initializationMs: Math.round(performance.now() - started), identityThreshold: .6, thresholdCalibrated: false, fixtures: [] };
function identify(embedding, enrolled) {
  const scores = enrolled.map((id) => ({ id, score: cosine(embedding, references[id]) }));
  const candidates = scores.filter((r) => r.score !== null && r.score >= .6);
  return { speakerId: candidates.length === 1 ? candidates[0].id : undefined, scores };
}
function tokenWords(tokens, windows, fixture, length) {
  const words = [];
  for (const point of tokens) {
    const id = attributeTokenPoint({ ...point, clockId: fixture.id }, windows, length, true).speakerId;
    const text = point.text.replaceAll('\u2581', ' ');
    if (/^(?:\u2581|\s)/u.test(point.text) || !words.length) words.push({ text: text.trimStart(), start: point.sample / 16000, points: [point.sample / 16000], speakerId: id });
    else {
      const word = words.at(-1); word.text += text; word.points.push(point.sample / 16000);
      if (word.speakerId !== id) word.speakerId = undefined;
    }
  }
  return words;
}
// Aggregate only model-predicted non-overlapping turn audio, capped at 15 seconds.
// No reference transcript, scripted boundary or expected speaker enters inference.
function identifyTurns(audio, turns, enrolled) {
  const identities = {}; const evidence = [];
  for (const cluster of new Set(turns.map((t) => t.cluster))) {
    const intervals = turns.filter((t) => t.cluster === cluster && t.end - t.start >= .5
      && !turns.some((other) => other.cluster !== cluster && other.start < t.end && other.end > t.start));
    const chunks = intervals.map((t) => audio.subarray(Math.ceil(t.start * 16000), Math.floor(t.end * 16000)));
    const samples = new Float32Array(Math.min(15 * 16000, chunks.reduce((sum, c) => sum + c.length, 0)));
    let offset = 0;
    for (const chunk of chunks) { const take = chunk.subarray(0, samples.length - offset); samples.set(take, offset); offset += take.length; }
    if (samples.length < 16000) { evidence.push({ cluster, seconds: samples.length / 16000 }); continue; }
    const embedding = extractor.compute(samples);
    const result = identify(embedding, enrolled); identities[cluster] = result.speakerId;
    evidence.push({ cluster, seconds: samples.length / 16000, ...result }); embedding.fill(0); samples.fill(0);
  }
  return { identities, evidence };
}
try {
  for (const fixture of manifest.fixtures) {
    const audio = readMonoWav(await readFile(new URL(`${fixture.id}.wav`, root)));
    const windows = []; const words = [];
    const initStart = performance.now();
    const pipeline = await createSharedPipeline(module, createOnlineRecognizer, assets, () => {}, { windowGate: 'energy', inspectEmbedding(window) {
      windows.push({ clockId: fixture.id, startSample: window.startSample, endSample: window.endSample, ...identify(window.embedding, fixture.enrolled) });
    } });
    const pipelineInitializationMs = performance.now() - initStart;
    const baselineStart = performance.now(); const finals = [];
    try {
      for (let offset = 0; offset < audio.length; offset += 1600) {
        const result = pipeline.accept({ clockId: fixture.id, sampleRate: 16000, startSample: offset, samples: audio.subarray(offset, offset + 1600) });
        if (result.isFinal) finals.push(result);
      }
      finals.push(pipeline.finish());
      for (const result of finals) {
        const assembled = tokenWords(result.tokenPoints, windows, fixture, audio.length);
        if (assembled.map((word) => word.text).join(' ').trim() !== result.text.trim()) throw new Error('Benchmark token assembly changed recognizer text');
        words.push(...assembled);
      }
    } finally { pipeline.close(); }
    const baselineMs = Math.round(performance.now() - baselineStart);
    const diarStart = performance.now(); const turns = diarizer.process(audio).segments;
    const { identities, evidence } = identifyTurns(audio, turns, fixture.enrolled);
    const diarizationMs = Math.round(performance.now() - diarStart);
    // Point-only Zipformer timing cannot establish complete word boundaries.
    const delayedWords = words.map((word) => {
      const ids = word.points.map((start) => timelineIdentity({ start }, turns, identities));
      return { ...word, speakerId: ids[0] && ids.every((id) => id === ids[0]) ? ids[0] : undefined };
    });
    report.fixtures.push({ id: fixture.id, duration: fixture.duration, pipelineInitializationMs: Math.round(pipelineInitializationMs), baselineMs, diarizationMs,
      words, delayedWords, turns, identities, evidence, windows: windows.length });
    await writeFile(new URL('local.json', root), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ fixture: fixture.id, baselineMs, diarizationMs, clusters: new Set(turns.map((t) => t.cluster)).size, namedClusters: Object.values(identities).filter(Boolean).length }));
    audio.fill(0);
  }
} finally { diarizer.close(); extractor.close(); Object.values(references).forEach((v) => v.fill(0)); }
