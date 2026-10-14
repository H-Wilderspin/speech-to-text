import type { RecognitionResults, TranscriptSegment } from './types';

export interface RecognizedSegment extends TranscriptSegment {
  // Native speech-event grouping only: this is not an audio time or a speaker ID.
  utterance?: number;
}

/** Results are a complete session snapshot, including mutable/removable interim slots. */
export function reconcileResults(
  previous: readonly RecognizedSegment[], results: RecognitionResults, sessionId: number, allowExtensions = false,
  utterance?: number,
): RecognizedSegment[] {
  const prior = new Map(previous.map((segment) => [segment.id, segment]));
  const stable = new Map(previous.filter((segment) => segment.isFinal).map((segment) => [segment.id, segment]));
  const next: RecognizedSegment[] = [];
  for (let index = 0; index < results.length; index++) {
    const id = `${sessionId}:${index}`;
    const confirmed = stable.get(id);
    const result = results[index];
    const text = result?.[0]?.transcript.trim();
    if (confirmed && !(allowExtensions && confirmed.utterance === utterance && result?.isFinal && text && extendsPhrase(confirmed.text, text))) {
      next.push(confirmed);
      stable.delete(id);
      continue;
    }
    stable.delete(id);
    const group = prior.get(id)?.utterance ?? utterance;
    if (text) next.push({ id, text, isFinal: result?.isFinal ?? false, ...(group === undefined ? {} : { utterance: group }) });
  }
  // A malformed/shrinking engine snapshot must never retract confirmed speech.
  const ordered = [...next, ...stable.values()].sort((a, b) => Number(a.id.split(':')[1]) - Number(b.id.split(':')[1]));
  return ordered;
}

export function collapseCumulativeResults(ordered: readonly RecognizedSegment[]): RecognizedSegment[] {
  // Some providers append cumulative hypotheses as new slots, even marking them
  // final. Collapse only strict phrase extensions within this native utterance;
  // never deduplicate separate recognition cycles or repeated words in a phrase.
  return ordered.reduce<RecognizedSegment[]>((segments, segment) => {
    const preceding = segments.at(-1);
    if (preceding && preceding.utterance === segment.utterance && extendsPhrase(preceding.text, segment.text)) {
      segments.pop();
      // One growing caption keeps its identity, including across Clear.
      segments.push({ ...segment, id: preceding.id });
    } else segments.push(segment);
    return segments;
  }, []);
}

function extendsPhrase(previous: string, next: string): boolean {
  const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const before = words(previous);
  const after = words(next);
  return before.length > 0 && after.length > before.length && before.every((word, index) => word === after[index]);
}
