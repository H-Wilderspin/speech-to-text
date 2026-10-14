import type { TranscriptSegment } from './types';

const wordBreaker = new Intl.Segmenter(undefined, { granularity: 'word' });
const wordStarts = (text: string) => [...wordBreaker.segment(text)].filter((part) => part.isWordLike).map((part) => part.index);

function sourceText(segments: readonly TranscriptSegment[]) {
  const text = new Map<string, string>();
  for (const segment of segments) {
    const id = segment.sourceSegmentId ?? segment.id;
    text.set(id, (text.get(id) ?? '') + segment.text);
  }
  return text;
}

/** A display boundary, not an audio timestamp. Keep native recognition and name
 * alignment context intact while hiding words already visible at Clear. */
export class ClearBoundary {
  private words = new Map<string, number>();

  reset() { this.words.clear(); }

  mark(segments: readonly TranscriptSegment[]) {
    this.words.clear();
    this.advance(segments);
  }

  /** Move beyond a command in the currently visible suffix, retaining old cuts. */
  advance(segments: readonly TranscriptSegment[]) {
    for (const [id, text] of sourceText(segments)) this.words.set(id, (this.words.get(id) ?? 0) + wordStarts(text).length);
  }

  apply(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
    if (!this.words.size) return [...segments];
    // Resolve the boundary in the complete source text first. Name slices may
    // split a number or a word in a language without spaces.
    const remaining = new Map<string, number>();
    for (const [id, text] of sourceText(segments)) {
      const count = this.words.get(id);
      if (count !== undefined) remaining.set(id, wordStarts(text)[count] ?? text.length);
    }
    return segments.flatMap((segment) => {
      const id = segment.sourceSegmentId ?? segment.id;
      if (!remaining.has(id)) return [segment];
      const start = remaining.get(id)!;
      remaining.set(id, Math.max(0, start - segment.text.length));
      if (start === 0) return [segment];
      return start >= segment.text.length ? [] : [{ ...segment, text: segment.text.slice(start) }];
    });
  }
}
