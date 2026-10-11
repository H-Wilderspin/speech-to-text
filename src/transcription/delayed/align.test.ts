import { expect, it } from 'vitest';
import { delayedNames } from './align';
import type { TranscriptSegment } from '../types';

const segment = (text: string, id = 'a', known = false): TranscriptSegment => ({ id, text, isFinal: true,
  ...(known ? { speakerId: 'voice', speakerName: 'McTest', speakerEstimated: true } : {}) });
const text = (segments: readonly TranscriptSegment[]) => segments.map((item) => item.text).join('');
it('adds delayed names without changing browser words, punctuation, casing or spacing', () => {
  const original = "Well, I’m ready to bring  the blue book tomorrow!";
  const result = delayedNames([segment(original)], [segment("WELL I'M READY TO BRING THE BLUE BOOK TOMORROW", 'local', true)]);
  expect(text(result)).toBe(original); expect(result.every((part) => part.speakerName === 'McTest')).toBe(true);
  expect(result.every((part) => part.startMs === undefined && part.endMs === undefined)).toBe(true);
});
it('preserves accurate browser corrections and labels only independently matched words', () => {
  const original = 'We saw Jupiter. Please bring the blue book to the table.';
  const result = delayedNames([segment(original)], [segment('WE SAW COMPUTERS PLEASE BRING THE BLUE BOOK TO THE TABLE', 'local', true)]);
  expect(text(result)).toBe(original);
  expect(result[0]).toMatchObject({ text: 'We saw Jupiter. ' }); expect(result[0]!.speakerId).toBeUndefined();
  expect(result.at(-1)!.speakerId).toBe('voice');
});
it('does not guess from short, repeated or reordered phrases', () => {
  const phrase = 'please bring the blue book here';
  for (const [browser, local] of [[phrase, `${phrase} ${phrase}`], [`${phrase} ${phrase}`, phrase], ['yes please', 'YES PLEASE'],
    [`${phrase} now we can begin our daily discussion`, `now we can begin our daily discussion ${phrase}`]]) {
    expect(delayedNames([segment(browser!)], [segment(local!, 'local', true)]).every((part) => !part.speakerId)).toBe(true);
  }
});
it('keeps interim and anonymous local evidence anonymous and preserves actual speaker splits', () => {
  const a = 'please bring the blue book to the table';
  expect(delayedNames([{ ...segment(a), isFinal: false }], [segment(a, 'local', true)])[0]!.speakerId).toBeUndefined();
  expect(delayedNames([segment(a)], [{ ...segment(a, 'local', true), isFinal: false }])[0]!.speakerId).toBeUndefined();
  const result = delayedNames([segment(a)], [segment('please bring the', 'one'), segment('blue book to the table', 'two', true)]);
  expect(text(result)).toBe(a); expect(result[0]!.speakerId).toBeUndefined(); expect(result.at(-1)!.speakerId).toBe('voice');
});
