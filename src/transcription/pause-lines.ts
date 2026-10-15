import type { TranscriptSegment } from './types';

/** Presentation only. A provider pause can separate an unchanged prefix from
 * later words, but cannot supply missing word timestamps. If recognition revises
 * that prefix, keep the complete corrected text together instead of guessing. */
export class PauseLines {
  private boundaries = new Map<string, { text: string; ends: number[] }>();
  clear() { this.boundaries.clear(); }
  mark(segment: TranscriptSegment | undefined) {
    if (!segment?.text.trim()) return;
    const previous = this.boundaries.get(segment.id);
    const ends = previous && segment.text.startsWith(previous.text) ? [...previous.ends] : [];
    if (ends.at(-1) !== segment.text.length) ends.push(segment.text.length);
    this.boundaries.set(segment.id, { text: segment.text, ends });
  }
  apply(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
    const ids = new Set(segments.map((segment) => segment.id));
    for (const id of this.boundaries.keys()) if (!ids.has(id)) this.boundaries.delete(id);
    return segments.flatMap((segment) => {
      const boundary = this.boundaries.get(segment.id);
      if (!boundary || !segment.text.startsWith(boundary.text)) return [segment];
      const cuts = boundary.ends.filter((end) => end < segment.text.length
        && /^[\s\p{P}]/u.test(segment.text.slice(end)));
      let start = 0;
      return [...cuts, segment.text.length].map((end, index) => {
        const part = { ...segment, id: index ? `${segment.id}:line:${index}` : segment.id,
          text: segment.text.slice(start, end), ...(index < cuts.length ? { pauseAfter: true } : {}) };
        start = end;
        return part;
      }).filter((segment) => segment.text.trim());
    });
  }
}
