import type { TranscriptSegment } from '../types';

/** Display-only casing for the uppercase local recognizer; no word correction,
 * punctuation inference, timing change or modification of saved display names. */
export function readableLocalCaptions(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  if (segments.some((segment) => segment.text !== segment.text.toUpperCase())) return [...segments];
  let sentenceStart = true;
  return segments.map((segment) => {
    const text = segment.text.toLowerCase().replace(/\bi\b/gu, 'I');
    let formatted = '';
    for (const character of text) {
      const letter = /\p{L}/u.test(character);
      formatted += sentenceStart && letter ? character.toUpperCase() : character;
      if (letter || /\p{N}/u.test(character)) sentenceStart = false;
      if (/[.!?]/u.test(character)) sentenceStart = true;
    }
    return { ...segment, text: formatted };
  });
}
