import type { TranscriptSegment } from './types';

/** Act only on confirmed words; provisional guesses must not trigger controls. */
export function findVoiceCommand(segments: readonly TranscriptSegment[]): {
  action: 'stop' | 'clear'; before: TranscriptSegment[];
} | null {
  const confirmed = segments.filter((segment) => segment.isFinal);
  const text = confirmed.map((segment) => segment.text).join(' ');
  const pattern = /(?<![\p{L}\p{N}_])command[\s\p{P}]+(stop|clear)(?![\p{L}\p{N}_])/iu;
  const match = pattern.exec(text);
  if (!match) return null;
  const before: TranscriptSegment[] = [];
  let offset = 0;
  for (const segment of confirmed) {
    if (offset >= match.index + match[0].length) break;
    const beforeCommand = segment.text.slice(0, match.index - offset).trimEnd();
    if (offset < match.index && beforeCommand) before.push({ ...segment, text: beforeCommand });
    offset += segment.text.length + 1;
  }
  return { action: match[1]!.toLowerCase() as 'stop' | 'clear', before };
}
