// Research-only contracts. No inference model or uncalibrated threshold is shipped to the UI.
export interface VoiceEmbedding { modelVersion: string; values: readonly number[] }
export interface Candidate { speakerId: string; embedding: VoiceEmbedding }
export interface Calibration { modelVersion: string; minimumCosine: number; minimumMargin: number; evidenceId: string }

export function cosine(a: readonly number[], b: readonly number[]): number | null {
  if (!a.length || a.length !== b.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
  const aNorm = Math.hypot(...a); const bNorm = Math.hypot(...b);
  if (!Number.isFinite(aNorm) || !Number.isFinite(bNorm) || aNorm === 0 || bNorm === 0) return null;
  return a.reduce((sum, value, i) => sum + (value / aNorm) * (b[i]! / bNorm), 0);
}

export function identify(query: VoiceEmbedding, candidates: readonly Candidate[], calibration?: Calibration): string | undefined {
  if (!calibration?.evidenceId.trim() || calibration.modelVersion !== query.modelVersion
    || !Number.isFinite(calibration.minimumCosine) || calibration.minimumCosine < -1 || calibration.minimumCosine > 1
    || !Number.isFinite(calibration.minimumMargin) || calibration.minimumMargin <= 0 || calibration.minimumMargin > 2) return undefined;
  const scores = candidates.filter((candidate) => candidate.embedding.modelVersion === query.modelVersion)
    .map((candidate) => ({ id: candidate.speakerId, score: cosine(query.values, candidate.embedding.values) }))
    .filter((candidate): candidate is { id: string; score: number } => candidate.score !== null)
    .sort((a, b) => b.score - a.score);
  const winner = scores[0]; const runnerUp = scores[1];
  if (!winner || winner.score < calibration.minimumCosine
    || (runnerUp && winner.score - runnerUp.score < calibration.minimumMargin)) return undefined;
  return winner.id;
}

export interface AudioSpan { startMs: number; endMs: number; clockId: string }
export interface SpeakerTurn extends AudioSpan { clusterId: string }
const valid = (span: AudioSpan) => Boolean(span.clockId) && Number.isFinite(span.startMs) && Number.isFinite(span.endMs)
  && span.startMs >= 0 && span.endMs > span.startMs;

/** Return an ephemeral cluster only for an entirely contained, unambiguous utterance. */
export function alignUtterance(span: AudioSpan | undefined, turns: readonly SpeakerTurn[]): string | undefined {
  if (!span || !valid(span)) return undefined;
  const relevant = turns.filter((turn) => turn.clockId === span.clockId);
  if (relevant.some((turn) => !valid(turn))) return undefined;
  const overlapping = relevant.filter((turn) => turn.startMs < span.endMs && turn.endMs > span.startMs);
  const turn = overlapping[0];
  return overlapping.length === 1 && turn && turn.startMs <= span.startMs && turn.endMs >= span.endMs ? turn.clusterId : undefined;
}
