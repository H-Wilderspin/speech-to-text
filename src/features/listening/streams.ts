import type { TranscriptSegment } from '../../transcription/types';

export function assignedSegments(segments: readonly TranscriptSegment[]) {
  return segments.filter((segment) => segment.isFinal && segment.speakerId?.trim() && segment.speakerName?.trim());
}

/** Rejoin exact browser slices so delayed names never rearrange the live pane. */
export function liveSegments(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  for (const segment of segments) {
    const id = segment.sourceSegmentId ?? segment.id;
    const previous = result.at(-1);
    if (previous?.id === id && previous.isFinal === segment.isFinal) previous.text += segment.text;
    else result.push({ id, text: segment.text, isFinal: segment.isFinal });
  }
  return result;
}
