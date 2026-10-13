import { readFile, writeFile } from 'node:fs/promises';
import { scoreWords } from './comparison-metrics.mjs';
const root = new URL('./private/comparison/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root)));
const result = JSON.parse(await readFile(new URL('service-results.json', root)));
const metrics = {}; let overlapAssignedWords = 0;
for (const fixture of manifest.fixtures) {
  const row = result.fixtures.find((item) => item.id === fixture.id);
  if (!fixture.overlap) for (const [key, value] of Object.entries(scoreWords(fixture.words, row.words))) metrics[key] = (metrics[key] ?? 0) + value;
  else overlapAssignedWords += row.words.filter((word) => word.speakerId && fixture.playback.filter((turn) => turn.start <= word.start && turn.end > word.start).length > 1).length;
}
const report = { syntheticOnly: true, metrics, overlapAssignedWords, nativeWasmCosine: result.nativeWasmCosine,
  totalProcessingMs: result.fixtures.reduce((sum, row) => sum + row.processingMs, 0) };
try {
  const http = JSON.parse(await readFile(new URL('service-http-results.json', root)));
  const fixture = manifest.fixtures.find((item) => item.id === 'known-long');
  const reference = [0, 1, 2].flatMap((repeat) => fixture.words.map((word) => ({ ...word,
    start: word.start + repeat * fixture.duration, utterance: `${repeat}-${word.utterance}` })));
  report.httpWindows = { seconds: http.seconds, windows: http.windows, metrics: scoreWords(reference, http.words) };
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(new URL('../docs/service-benchmark-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
