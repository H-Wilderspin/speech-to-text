import type { TranscriptSegment } from './types';

/** Act only on confirmed words; an interim guess must not end capture. */
export function consumeStopCommand(segments: readonly TranscriptSegment[]): TranscriptSegment[] | null {
  const confirmed = segments.filter((segment) => segment.isFinal);
  const text = confirmed.map((segment) => segment.text).join(' ');
  const match = /(?<![\p{L}\p{N}_])command[\s\p{P}]+stop(?![\p{L}\p{N}_])/iu.exec(text);
  if (!match) return null;
  const kept: TranscriptSegment[] = [];
  let offset = 0;
  for (const segment of confirmed) {
    if (offset >= match.index) break;
    const beforeCommand = segment.text.slice(0, match.index - offset).trimEnd();
    if (beforeCommand) kept.push({ ...segment, text: beforeCommand });
    offset += segment.text.length + 1;
  }
  return kept;
}
