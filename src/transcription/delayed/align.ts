import type { TranscriptSegment } from '../types';

const ANCHOR_WORDS = 6;
type Word = { key: string; start: number; end: number; segment: number };
function words(segments: readonly TranscriptSegment[]): Word[] {
  return segments.flatMap((segment, index) => [...segment.text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)]
    .map((match) => ({ key: match[0].toLowerCase().replaceAll('’', "'"), start: match.index, end: match.index + match[0].length, segment: index })));
}
function anchors(tokens: readonly Word[]) {
  const index = new Map<string, number[]>();
  for (let at = 0; at <= tokens.length - ANCHOR_WORDS; at++) {
    const key = tokens.slice(at, at + ANCHOR_WORDS).map((word) => word.key).join(' ');
    const positions = index.get(key) ?? []; positions.push(at); index.set(key, positions);
  }
  return index;
}

/** Transfer estimates only through unique exact six-word anchors, never callback
 * arrival times. This is experimental text correspondence, NOT forced alignment
 * or browser word timestamps. Browser wording/punctuation is never replaced. */
export function delayedNames(browser: readonly TranscriptSegment[], local: readonly TranscriptSegment[]): TranscriptSegment[] {
  if (!local.some((segment) => segment.isFinal && segment.speakerEstimated && segment.speakerId)) return [...browser];
  const target = words(browser); const source = words(local);
  const bySegment = new Map<number, Word[]>();
  for (const word of target) {
    const list = bySegment.get(word.segment) ?? []; list.push(word); bySegment.set(word.segment, list);
  }
  const a = anchors(target); const b = anchors(source);
  const pairs: { target: number; source: number }[] = [];
  for (const [key, positions] of a) {
    const candidates = b.get(key);
    if (positions.length === 1 && candidates?.length === 1) pairs.push({ target: positions[0]!, source: candidates[0]! });
  }
  pairs.sort((left, right) => left.target - right.target);
  // Reordered/conflicting recognitions have no trustworthy correspondence.
  if (pairs.some((pair, i) => i > 0 && pair.source <= pairs[i - 1]!.source)) return [...browser];
  const mapping = new Map<number, number>(); const conflicts = new Set<number>();
  for (const pair of pairs) for (let offset = 0; offset < ANCHOR_WORDS; offset++) {
    const to = pair.target + offset; const from = pair.source + offset;
    if (mapping.has(to) && mapping.get(to) !== from) conflicts.add(to);
    else mapping.set(to, from);
  }
  const labels = new Map<number, Map<number, TranscriptSegment>>();
  for (const [to, from] of mapping) {
    if (conflicts.has(to)) continue;
    const word = target[to]!; const evidence = local[source[from]!.segment]!;
    if (!browser[word.segment]!.isFinal || !evidence.isFinal || !evidence.speakerEstimated || !evidence.speakerId || !evidence.speakerName) continue;
    const segmentLabels = labels.get(word.segment) ?? new Map<number, TranscriptSegment>();
    segmentLabels.set(word.start, evidence); labels.set(word.segment, segmentLabels);
  }
  return browser.flatMap((segment, index) => {
    const segmentLabels = labels.get(index); if (!segmentLabels) return [segment];
    const tokens = bySegment.get(index)!;
    const pieces: TranscriptSegment[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i]!; const label = segmentLabels.get(word.start);
      const start = i === 0 ? 0 : word.start;
      const end = tokens[i + 1]?.start ?? segment.text.length;
      const text = segment.text.slice(start, end);
      const previous = pieces.at(-1);
      if (previous && previous.speakerId === label?.speakerId && previous.speakerName === label?.speakerName) previous.text += text;
      else pieces.push({ id: `${segment.id}:names:${start}`, text, isFinal: segment.isFinal,
        ...(label ? { speakerId: label.speakerId, speakerName: label.speakerName, speakerEstimated: true } : {}) });
    }
    return pieces;
  });
}
