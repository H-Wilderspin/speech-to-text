import { cosine } from '../../identification/similarity';
import type { TranscriptSegment } from '../types';
import type { EmbeddingWindow, ReferenceVoice, VoiceWindow, PipelineResult, TokenPoint } from './types';

// Experimental baseline from sherpa's speaker-identification-with-vad example,
// NOT calibrated human accuracy. User explicitly opted into estimated names.
export const EXPERIMENTAL_MINIMUM_COSINE = .6;

export function suggestWindow(window: EmbeddingWindow, references: readonly ReferenceVoice[]): VoiceWindow {
  const candidates = references.filter((reference) => {
    const score = cosine(window.embedding, reference.embedding);
    return score !== null && score >= EXPERIMENTAL_MINIMUM_COSINE;
  });
  return { clockId: window.clockId, startSample: window.startSample, endSample: window.endSample,
    ...(candidates.length === 1 ? { speakerId: candidates[0]!.id } : {}) };
}

function suggestToken(point: TokenPoint, clockId: string, windows: readonly VoiceWindow[]): string | undefined {
  const evidence = windows.filter((window) => window.clockId === clockId && window.startSample <= point.sample && window.endSample > point.sample);
  const id = evidence[0]?.speakerId;
  return id && new Set(evidence.map((window) => window.startSample)).size >= 2
    && evidence.every((window) => window.speakerId === id) ? id : undefined;
}

/** Assemble whole BPE words before grouping: never split one word across names. */
export function suggestedCaptions(result: PipelineResult, windows: readonly VoiceWindow[], references: readonly ReferenceVoice[]): TranscriptSegment[] {
  const base = `local:${result.timing.segment}`;
  const anonymous = [{ id: `${base}:0`, text: result.text, isFinal: result.isFinal }];
  if (!result.text.trim()) return [];
  if (!result.isFinal || !result.tokenPoints.length) return anonymous;
  const words: { text: string; ids: (string | undefined)[] }[] = [];
  for (const point of result.tokenPoints) {
    if (!Number.isSafeInteger(point.sample) || point.sample < 0 || point.sample > result.acceptedSamples) return anonymous;
    // sherpa's public API may already convert SentencePiece's marker to a space.
    const startsWord = /^(?:▁|\s)/u.test(point.text);
    const text = point.text.replaceAll('▁', ' ');
    if (startsWord || !words.length) words.push({ text: text.trimStart(), ids: [suggestToken(point, result.clockId, windows)] });
    else { words.at(-1)!.text += text; words.at(-1)!.ids.push(suggestToken(point, result.clockId, windows)); }
  }
  // Unexpected tokenizer output must preserve the recognizer's exact text.
  if (words.map((word) => word.text).join(' ').trim() !== result.text.trim()) return anonymous;
  const segments: TranscriptSegment[] = [];
  for (const word of words) {
    const id = word.ids[0];
    const reference = id && word.ids.every((candidate) => candidate === id) ? references.find((voice) => voice.id === id) : undefined;
    const previous = segments.at(-1);
    if (previous && previous.speakerId === reference?.id) previous.text += ` ${word.text}`;
    else segments.push({ id: `${base}:${segments.length}`, text: word.text, isFinal: true,
      ...(reference ? { speakerId: reference.id, speakerName: reference.name, speakerEstimated: true } : {}) });
  }
  return segments;
}

/** Bounded pending sample-clock evidence; committed text remains in memory only. */
export class SuggestedTranscript {
  private history: TranscriptSegment[] = [];
  private pending = new Map<number, PipelineResult>();
  private windows: VoiceWindow[] = [];
  private committedThrough = -1;
  constructor(private readonly references: readonly ReferenceVoice[]) {}
  addWindow(window: VoiceWindow) { this.windows.push(window); }
  update(result: PipelineResult, finished = false): TranscriptSegment[] {
    if (result.timing.segment > this.committedThrough) this.pending.set(result.timing.segment, result);
    const pendingText: TranscriptSegment[] = [];
    for (const [id, entry] of this.pending) {
      const lastSample = entry.tokenPoints.at(-1)?.sample ?? entry.acceptedSamples;
      // Wait for all covering future windows before suggesting names.
      const settled = entry.isFinal && (finished || result.acceptedSamples >= lastSample + 48000);
      const captions = suggestedCaptions(entry, settled ? this.windows : [], this.references);
      if (settled) { this.history.push(...captions); this.pending.delete(id); this.committedThrough = Math.max(this.committedThrough, id); }
      else pendingText.push(...captions);
    }
    const oldestPending = Math.min(result.acceptedSamples, ...[...this.pending.values()].map((entry) => entry.tokenPoints[0]?.sample ?? entry.acceptedSamples));
    this.windows = this.windows.filter((window) => window.endSample > oldestPending);
    const output = [...this.history, ...pendingText];
    let excess = output.reduce((total, segment) => total + segment.text.length, 0) - 100_000;
    while (excess > 0 && this.history.length) { excess -= this.history[0]!.text.length; this.history.shift(); }
    return [...this.history, ...pendingText];
  }
}
