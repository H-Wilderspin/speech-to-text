import type { TranscriptSegment } from '../../transcription/types';

const abbreviations = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc']);

/** One replacement per original UTF-16 position, so casing/spacing changes can
 * be distributed back to speaker slices without changing recognition offsets. */
function displayCharacters(text: string, language: string): string[] {
  const output = text.split('');
  const english = language.startsWith('en');
  const tokens = [...text.matchAll(/\S+/gu)];
  let token = 0;
  let previousEnd = 0;
  let previousWord = '';
  for (const match of text.matchAll(/[\p{L}\p{M}\p{N}_]+(?:['’][\p{L}\p{M}\p{N}_]+)*/gu)) {
    const word = match[0]; const index = match.index;
    while (tokens[token] && index >= tokens[token]!.index + tokens[token]![0].length) token++;
    // Leave addresses, paths, decimals and dotted identifiers alone.
    const technical = /[@/\\]|[\p{L}\p{N}]\.[\p{L}\p{N}]/u.test(tokens[token]?.[0] ?? '');
    const gap = text.slice(previousEnd, index);
    const period = /(?<!\.)\.["'”’»)\]}]*\s+$/u.test(gap);
    const abbreviation = abbreviations.has(previousWord.toLowerCase())
      || (/^\p{L}$/u.test(previousWord) && previousWord.toLowerCase() !== 'i')
      || /(?:\p{L}\.){2,}["'”’»)\]}]*\s+$/u.test(text.slice(Math.max(0, index - 32), index));
    const sentenceStart = previousEnd === 0 || /[!?]["'”’»)\]}]*\s+$/u.test(gap) || (period && !abbreviation);
    const pronoun = english && /^i(?:['’](?:m|d|ll|ve))?$/iu.test(word);
    // Mixed-case words such as iPhone retain the provider's casing.
    if (!technical && (pronoun || (sentenceStart && word === word.toLocaleLowerCase(language)))) {
      const first = [...word][0]!;
      output[index] = first.toLocaleUpperCase(language);
      for (let offset = 1; offset < first.length; offset++) output[index + offset] = '';
    }
    previousEnd = index + word.length; previousWord = word;
  }
  for (const match of text.matchAll(/\s+/gu)) {
    const index = match.index; const end = index + match[0].length;
    const omit = index === 0 || end === text.length || (english && /[,.;:!?]/u.test(text[end]!));
    output[index] = omit ? '' : ' ';
    for (let offset = index + 1; offset < end; offset++) output[offset] = '';
  }
  return output;
}

/** Presentation only. Format complete source lines before visibility filtering;
 * a named fragment in the middle of a sentence is not a fresh sentence start. */
export function formatCaptionSegments(segments: readonly TranscriptSegment[], language = 'en-GB'): TranscriptSegment[] {
  const result: TranscriptSegment[] = [];
  for (let start = 0; start < segments.length;) {
    const first = segments[start]!;
    const source = first.sourceSegmentId ?? first.id;
    let end = start + 1;
    while (end < segments.length && (segments[end]!.sourceSegmentId ?? segments[end]!.id) === source
      && segments[end]!.sessionId === first.sessionId) end++;
    const group = segments.slice(start, end);
    const characters = displayCharacters(group.map((segment) => segment.text).join(''), language);
    let offset = 0;
    for (const segment of group) {
      const text = characters.slice(offset, offset + segment.text.length).join('');
      offset += segment.text.length;
      result.push({ ...segment, text });
    }
    start = end;
  }
  return result;
}
