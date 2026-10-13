import { readFile, writeFile } from 'node:fs/promises';
import { scoreWords, timelineIdentity } from './comparison-metrics.mjs';
const root = new URL('./private/comparison/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const manifest = await read('manifest.json'); const local = await read('local.json'); const whisper = await read('whisper.json');
const regionWhisper = await read('whisper-regions.json');
const rows = [];
for (const fixture of manifest.fixtures) {
  const baseline = local.fixtures.find((f) => f.id === fixture.id);
  const delayed = whisper.fixtures.find((f) => f.id === fixture.id);
  const regional = regionWhisper.fixtures.find((f) => f.id === fixture.id);
  if (!baseline || !delayed || !regional) throw new Error(`Missing result for ${fixture.id}`);
  const joined = delayed.words.map((word) => ({ ...word, speakerId: timelineIdentity(word, baseline.turns, baseline.identities) }));
  const oracleIdentities = Object.fromEntries(fixture.playback.map((turn) => [turn.cluster, fixture.enrolled.includes(turn.voice) ? turn.voice : undefined]));
  const oracle = delayed.words.map((word) => ({ ...word, speakerId: timelineIdentity(word, fixture.playback, oracleIdentities) }));
  const regionalJoined = regional.words.map((word) => ({ ...word, speakerId: timelineIdentity(word, baseline.turns, baseline.identities) }));
  const regionalOracle = regional.words.map((word) => ({ ...word, speakerId: timelineIdentity(word, fixture.playback, oracleIdentities) }));
  // Ground-truth words are only an evaluation probe, NEVER an inference input.
  const identityProbe = fixture.words.map((word) => ({ ...word, speakerId: timelineIdentity({ start: word.start }, baseline.turns, baseline.identities) }));
  const routes = [
    ['current-local-components', baseline.words, baseline.baselineMs],
    ['zipformer-plus-delayed-turns', baseline.delayedWords, baseline.baselineMs + baseline.diarizationMs],
    ['whisper-plus-delayed-turns', joined, delayed.processingMs + baseline.diarizationMs],
    ['whisper-regions-plus-delayed-turns', regionalJoined, regional.processingMs + baseline.diarizationMs],
    ['oracle-turns-and-identity-NOT-A-ROUTE', oracle, null],
    ['regional-oracle-NOT-A-ROUTE', regionalOracle, null],
    ['reference-word-onsets-speaker-probe-NOT-A-ROUTE', identityProbe, baseline.diarizationMs],
  ];
  for (const [route, words, processingMs] of routes) {
    rows.push({ fixture: fixture.id, route, overlap: fixture.overlap, duration: fixture.duration, processingMs,
      // Simultaneous transcripts do not have a unique linear word order.
      metrics: fixture.overlap ? null : scoreWords(fixture.words, words),
      overlapAssignedWords: fixture.overlap ? words.filter((word) => word.speakerId && fixture.playback.filter((t) => t.start <= word.start && t.end > word.start).length > 1).length : null,
      utterances: fixture.overlap ? null : [...new Set(fixture.words.map((w) => w.utterance))].map((utterance) => {
        const expected = fixture.words.filter((w) => w.utterance === utterance);
        return { utterance, expectedWords: expected.length, enrolled: !!expected[0]?.speakerId };
      }),
    });
  }
}
const summaries = [...new Set(rows.map((r) => r.route))].map((route) => {
  const selected = rows.filter((r) => r.route === route);
  const sums = {};
  for (const row of selected) for (const [key, value] of Object.entries(row.metrics ?? {})) sums[key] = (sums[key] ?? 0) + value;
  const processingMs = selected.some((r) => r.processingMs === null) ? null : selected.reduce((sum, r) => sum + r.processingMs, 0);
  return { route, ...sums, wordErrorRate: sums.edits / sums.referenceWords,
    correctlyNamedWordCoverage: sums.correctlyNamedWords / sums.knownWords,
    processingMs, audioSeconds: selected.reduce((sum, r) => sum + r.duration, 0),
    fixtureProcessingMs: processingMs === null ? null : { min: Math.min(...selected.map((r) => r.processingMs)), max: Math.max(...selected.map((r) => r.processingMs)) },
    overlapAssignedWords: selected.reduce((sum, r) => sum + (r.overlapAssignedWords ?? 0), 0) };
});
const report = { date: new Date().toISOString(), syntheticOnly: true, humanAccuracyMeasured: false,
  managedApi: 'Not run: user requested local first; no API access', modernPyannote: 'Not run: Community-1 model requires Hugging Face acceptance/token',
  host: local.host, modelHashes: local.hashes,
  whisper: Object.fromEntries(Object.entries(whisper).filter(([key]) => key !== 'fixtures')),
  regionWhisper: Object.fromEntries(Object.entries(regionWhisper).filter(([key]) => key !== 'fixtures')),
  localInitializationMs: local.initializationMs, identityThreshold: local.identityThreshold, thresholdCalibrated: false,
  stageTimings: local.fixtures.map((fixture) => ({ id: fixture.id, baselineMs: fixture.baselineMs, diarizationAndIdentityMs: fixture.diarizationMs,
    whisperMs: whisper.fixtures.find((f) => f.id === fixture.id).processingMs,
    regionalWhisperMs: regionWhisper.fixtures.find((f) => f.id === fixture.id).processingMs })),
  predictedSpeakers: local.fixtures.map((fixture) => ({ id: fixture.id, clusters: new Set(fixture.turns.map((turn) => turn.cluster)).size,
    matchedClusters: Object.values(fixture.identities).filter(Boolean).length, evidence: fixture.evidence })),
  limitations: [
    'Only two desktop TTS voices, never human validation; Zira is unenrolled in the one-profile cases but enrolled in a separate two-profile scenario.',
    'Current local components exclude browser ASR and text correspondence; this is not a reproduction of the visible app or its live recognition WER.',
    'Delayed diarizer is the existing sherpa ONNX experiment, not modern pyannote Community-1, Precision or WhisperX.',
    'Zipformer emits token points, Whisper emits estimated word intervals: strict attribution uses available coordinates without inventing end times.',
    'Reports the final unpaced CPU pass per fixture; baseline was rerun once to verify text assembly with identical accuracy counts. Model initialization, collection delay, transport and UI excluded. Serial sums are not measured live end-to-end latency.',
    'Whisper route sums separately measured Whisper and diarization runtimes; Zipformer delayed total includes redundant baseline window embeddings.',
    'WER/word coverage exclude overlap; overlap count uses scripted playback ranges including edge silence, not human DER.',
    'Complete utterance count means every reference word was recognized and correctly named; WER separately counts extra inserted words.',
    'Oracle uses scripted identities and playback intervals; it diagnoses a ceiling and must never be presented as deployable inference.',
    'No cross-chunk reconciliation, forced alignment, real-time queues or p95 latency tested.',
  ],
  fixtures: manifest.fixtures.map((fixture) => ({ id: fixture.id, duration: fixture.duration, enrolled: fixture.enrolled, overlap: fixture.overlap, sha256: fixture.sha256 })), summaries, rows };
const output = process.argv[2] ?? new URL('summary.json', root);
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summaries, null, 2));
