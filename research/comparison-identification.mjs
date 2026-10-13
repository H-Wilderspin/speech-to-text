import { cosine } from '../src/identification/similarity.ts';

export function identifyEmbedding(embedding, enrolled, references) {
  const scores = enrolled.map((id) => ({ id, score: cosine(embedding, references[id]) }));
  const candidates = scores.filter((r) => r.score !== null && r.score >= .6);
  return { speakerId: candidates.length === 1 ? candidates[0].id : undefined, scores };
}

// Identical policy for both delayed diarizers: predicted non-overlapping turns,
// at least one second of usable audio, at most 15 seconds per cluster.
export function identifyTurns(audio, turns, enrolled, extractor, references) {
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
    const result = identifyEmbedding(embedding, enrolled, references); identities[cluster] = result.speakerId;
    evidence.push({ cluster, seconds: samples.length / 16000, ...result }); embedding.fill(0); samples.fill(0);
  }
  return { identities, evidence };
}
