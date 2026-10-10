import type { RecognitionResults, TranscriptSegment } from './types';

/** Results are a complete session snapshot, including mutable/removable interim slots. */
export function reconcileResults(
  previous: readonly TranscriptSegment[], results: RecognitionResults, sessionId: number,
): TranscriptSegment[] {
  const stable = new Map(previous.filter((segment) => segment.isFinal).map((segment) => [segment.id, segment]));
  const next: TranscriptSegment[] = [];
  for (let index = 0; index < results.length; index++) {
    const id = `${sessionId}:${index}`;
    const confirmed = stable.get(id);
    if (confirmed) {
      next.push(confirmed);
      stable.delete(id);
      continue;
    }
    const result = results[index];
    const text = result?.[0]?.transcript.trim();
    if (text) next.push({ id, text, isFinal: result?.isFinal ?? false });
  }
  // A malformed/shrinking engine snapshot must never retract confirmed speech.
  return [...next, ...stable.values()].sort((a, b) => Number(a.id.split(':')[1]) - Number(b.id.split(':')[1]));
}
