import { expect, it } from 'vitest';
import { formatCaptionSegments } from './caption-format';
import type { TranscriptSegment } from '../../transcription/types';

const format = (text: string, language = 'en-GB') => formatCaptionSegments([{ id: 'one', text, isFinal: false }], language)[0]!.text;

it('capitalizes line/sentence starts and English pronouns while retaining existing casing', () => {
  expect(format('  “hello grandad.” would you like tea ? i can make it. i’m ready and i\'ll ask NASA about iPhone  '))
    .toBe('“Hello grandad.” Would you like tea? I can make it. I’m ready and I\'ll ask NASA about iPhone');
  expect(format('iPhone works. eBay too. i\'ve checked and i’d agree')).toBe('iPhone works. eBay too. I\'ve checked and I’d agree');
});

it('avoids guessing sentence boundaries inside abbreviations, addresses and numbers', () => {
  expect(format('dr. smith paid 3.14 pounds. next came the U.K. forecast... still unclear! really? yes.'))
    .toBe('Dr. smith paid 3.14 pounds. Next came the U.K. forecast... still unclear! Really? Yes.');
  expect(format('https://example.com/a stays as typed. email i@example.com or use example.org.'))
    .toBe('https://example.com/a stays as typed. Email i@example.com or use example.org.');
  expect(format('123 apples and NASA data')).toBe('123 apples and NASA data');
});

it('preserves raw text and session metadata while formatting each line', () => {
  const raw: TranscriptSegment[] = [{ id: 'a', sessionId: 4, revision: 7, text: 'please  pass the NASA manual.', isFinal: false }];
  const original = structuredClone(raw);
  expect(formatCaptionSegments(raw)).toEqual([{ ...raw[0], text: 'Please pass the NASA manual.' }]);
  expect(raw).toEqual(original);
  expect(format('\u00dfeta bleibt gleich.', 'de-DE')).toBe('SSeta bleibt gleich.');
});

it('recomputes revisions and formats new lines without appending or inferring punctuation', () => {
  expect(format('a blue')).toBe('A blue');
  expect(format('a new day')).toBe('A new day');
  expect(formatCaptionSegments([
    { id: 'a', text: 'first phrase', isFinal: false },
    { id: 'a:line:1', text: ' next phrase', isFinal: false },
  ]).map((part) => part.text)).toEqual(['First phrase', 'Next phrase']);
});

it('limits pronoun rules to English and preserves French punctuation spacing', () => {
  expect(format('hola i adiós. qué tal?', 'es-ES')).toBe('Hola i adiós. Qué tal?');
  expect(format('bonjour ! je  suis ici.', 'fr-FR')).toBe('Bonjour ! Je suis ici.');
});
