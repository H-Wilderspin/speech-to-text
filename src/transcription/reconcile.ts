import type { RecognitionResults, TranscriptSegment } from './types';

/** Results are a complete session snapshot, including mutable/removable interim slots. */
export function reconcileResults(
  previous: readonly TranscriptSegment[], results: RecognitionResults, sessionId: number, singleUtterance = false,
): TranscriptSegment[] {
  const stable = new Map(previous.filter((segment) => segment.isFinal).map((segment) => [segment.id, segment]));
  const next: TranscriptSegment[] = [];
  for (let index = 0; index < results.length; index++) {
    const id = `${sessionId}:${index}`;
    const confirmed = stable.get(id);
    const result = results[index];
    const text = result?.[0]?.transcript.trim();
    if (confirmed && !(singleUtterance && result?.isFinal && text && extendsPhrase(confirmed.text, text))) {
      next.push(confirmed);
      stable.delete(id);
      continue;
    }
    stable.delete(id);
    if (text) next.push({ id, text, isFinal: result?.isFinal ?? false });
  }
  // A malformed/shrinking engine snapshot must never retract confirmed speech.
  const ordered = [...next, ...stable.values()].sort((a, b) => Number(a.id.split(':')[1]) - Number(b.id.split(':')[1]));
  return ordered;
}

export function collapseCumulativeResults(ordered: readonly TranscriptSegment[]): TranscriptSegment[] {
  // Some providers append cumulative hypotheses as new slots, even marking them
  // final. Collapse only strict phrase extensions within this native utterance;
  // never deduplicate separate recognition cycles or repeated words in a phrase.
  return ordered.reduce<TranscriptSegment[]>((segments, segment) => {
    const preceding = segments.at(-1);
    if (preceding && extendsPhrase(preceding.text, segment.text)) segments.pop();
    segments.push(segment);
    return segments;
  }, []);
}

function extendsPhrase(previous: string, next: string): boolean {
  const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const before = words(previous);
  const after = words(next);
  return before.length > 0 && after.length > before.length && before.every((word, index) => word === after[index]);
}
