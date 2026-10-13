import { readFile, writeFile } from 'node:fs/promises';
import { createExtractor } from './speaker-inference.mjs';
import { readMonoWav } from './asr-streaming.mjs';
import { identifyTurns } from './comparison-identification.mjs';
import { timelineIdentity, scoreWords } from './comparison-metrics.mjs';
const root = new URL('./private/comparison/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const manifest = await read('manifest.json'); const community = await read('community-turns.json');
const whisper = await read('whisper-regions.json');
const aligned = process.argv.includes('--aligned') ? await read('whisper-aligned.json') : undefined;
const publicRoot = new URL('../public/local/v1/', import.meta.url);
const { default: createModule } = await import(new URL('pipeline-runtime.mjs', publicRoot));
const module = await createModule({ wasmBinary: await readFile(new URL('pipeline-runtime.wasm', publicRoot)), print: () => {}, printErr: () => {} });
const extractor = await createExtractor(module, await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url)));
const references = {}; const rows = [];
try {
  for (const voice of ['Hazel', 'Zira']) references[voice] = extractor.compute(readMonoWav(await readFile(new URL(`${voice}-profile.wav`, root))));
  for (const fixture of manifest.fixtures) {
    const result = community.fixtures.find((f) => f.id === fixture.id);
    const transcription = whisper.fixtures.find((f) => f.id === fixture.id);
    if (!result || !transcription) throw new Error('Missing inference result');
    for (const turn of result.turns) if (!Number.isFinite(turn.start) || !Number.isFinite(turn.end) || turn.start < 0 || turn.end <= turn.start || turn.end > fixture.duration) throw new Error('Invalid diarization coordinates');
    const audio = readMonoWav(await readFile(new URL(`${fixture.id}.wav`, root)));
    const routes = ['community-cluster-identity', 'community-turn-identity'];
    if (aligned) routes.push('community-cluster-identity-aligned', 'community-turn-identity-aligned');
    for (const route of routes) {
      // Follow-up ablation: do not let one mixed anonymous cluster propagate its
      // aggregate identity to every turn. No scripted boundaries enter this path.
      const turns = route.includes('turn-identity') ? result.turns.map((turn, index) => ({ ...turn, cluster: index })) : result.turns;
      const wordResult = route.endsWith('-aligned') ? aligned.fixtures.find((f) => f.id === fixture.id) : transcription;
      if (!wordResult) throw new Error('Missing aligned result');
      const started = performance.now();
      const { identities, evidence } = identifyTurns(audio, turns, fixture.enrolled, extractor, references);
      const identificationMs = Math.round(performance.now() - started);
      const words = wordResult.words.map((word) => ({ ...word, speakerId: Number.isFinite(word.start) && Number.isFinite(word.end) ? timelineIdentity(word, turns, identities) : undefined }));
      rows.push({ route, fixture: fixture.id, duration: fixture.duration, clusters: new Set(result.turns.map((t) => t.cluster)).size,
        diarizationMs: result.processingMs, identificationMs, transcriptionMs: transcription.processingMs, alignmentMs: wordResult.alignmentMs ?? 0,
        metrics: fixture.overlap ? null : scoreWords(fixture.words, words), evidence,
        overlapAssignedWords: fixture.overlap ? words.filter((word) => word.speakerId && fixture.playback.filter((t) => t.start <= word.start && t.end > word.start).length > 1).length : null });
    }
    audio.fill(0);
  }
} finally { extractor.close(); Object.values(references).forEach((v) => v.fill(0)); }
const summaries = [...new Set(rows.map((row) => row.route))].map((route) => {
  const selected = rows.filter((row) => row.route === route); const metrics = {};
  for (const row of selected) for (const [key, value] of Object.entries(row.metrics ?? {})) metrics[key] = (metrics[key] ?? 0) + value;
  return { route, metrics, timings: { diarizationMs: selected.reduce((sum, r) => sum + r.diarizationMs, 0),
    identificationMs: selected.reduce((sum, r) => sum + r.identificationMs, 0), transcriptionMs: selected.reduce((sum, r) => sum + r.transcriptionMs, 0),
    alignmentMs: selected.reduce((sum, r) => sum + r.alignmentMs, 0) } };
});
const report = { date: new Date().toISOString(), syntheticOnly: true, model: community.model, revision: community.revision,
  versions: community.versions, hashes: community.hashes, initializationMs: community.initializationMs, device: community.device, threads: community.threads,
  identityModel: 'unchanged ERes2Net; same enrollment and 0.60 experimental threshold', summaries, rows,
  alignment: aligned ? Object.fromEntries(Object.entries(aligned).filter(([key]) => key !== 'fixtures')) : null,
  limitations: ['Synthetic fixtures only; not human accuracy or threshold calibration.', 'Whisper words reused; optional alignment only changes their times, with interpolation disabled.',
    'Per-turn identity and alignment are exploratory follow-ups on the same set, not held-out validation.',
    'Regular non-exclusive diarization retains overlap; no nearest-speaker or boundary filling.', 'Offline CPU timing; not live capture latency or phone performance.'], };
await writeFile(process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? new URL('community-summary.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summaries, null, 2));
