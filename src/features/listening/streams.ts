import type { TranscriptSegment } from '../../transcription/types';

export function assignedSegments(segments: readonly TranscriptSegment[], hiddenSpeakers: readonly string[] = []) {
  return segments.filter((segment) => (segment.isFinal || segment.speakerEvidenceFinal) && segment.speakerId?.trim()
    && segment.speakerName?.trim() && !hiddenSpeakers.includes(segment.speakerId));
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
