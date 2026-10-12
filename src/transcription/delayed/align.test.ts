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
it('requires final local evidence, preserves browser provisional state and actual speaker splits', () => {
  const a = 'please bring the blue book to the table';
  expect(delayedNames([{ ...segment(a), isFinal: false }], [segment(a, 'local', true)])[0]).toMatchObject({ isFinal: false, speakerId: 'voice', speakerEvidenceFinal: true });
  expect(delayedNames([segment(a)], [{ ...segment(a, 'local', true), isFinal: false }])[0]!.speakerId).toBeUndefined();
  const result = delayedNames([segment(a)], [segment('please bring the', 'one'), segment('blue book to the table', 'two', true)]);
  expect(text(result)).toBe(a); expect(result[0]!.speakerId).toBeUndefined(); expect(result.at(-1)!.speakerId).toBe('voice');
});
it('bridges one recognition difference with six uniquely agreeing words without labelling the difference', () => {
  for (const [browser, local] of [
    ['Please bring my blue book home tomorrow.', 'Please bring my new book home tomorrow.'],
    ['Please bring my blue book home tomorrow.', 'Please bring my book home tomorrow.'],
    ['Please bring my book home tomorrow.', 'Please bring my blue book home tomorrow.'],
  ]) {
    const result = delayedNames([segment(browser!)], [segment(local!, 'local', true)]);
    expect(text(result)).toBe(browser);
    expect(result[0]!.speakerId).toBe('voice'); expect(result.at(-1)!.speakerId).toBe('voice');
    if (browser!.includes('blue')) expect(result.find((piece) => piece.text.includes('blue'))!.speakerId).toBeUndefined();
  }
});
it('does not bridge short agreement, multiple errors, repetition or speaker changes', () => {
  for (const local of ['Please bring my new book home.', 'Please bring my very different book home tomorrow.',
    'Please bring my new book home tomorrow. Please bring my new book home tomorrow.']) {
    expect(delayedNames([segment('Please bring my blue book home tomorrow.')], [segment(local, 'local', true)]).some((piece) => piece.speakerId)).toBe(false);
  }
  const result = delayedNames([segment('Please bring my blue book home tomorrow.')], [segment('Please bring my new', 'one', true),
    { ...segment('book home tomorrow.', 'two', true), speakerId: 'different', speakerName: 'Different' }]);
  expect(result.some((piece) => piece.speakerId)).toBe(false);
});
it('revises attributed provisional text in place and withdraws unsupported evidence', () => {
  const local = [segment('Please bring my blue book home tomorrow.', 'local', true)];
  const first = delayedNames([{ ...segment('Please bring my blue book home tomorrow.'), isFinal: false }], local);
  const revised = delayedNames([{ ...segment('Please bring my blue book home tomorrow. Another sentence.'), isFinal: false }], local);
  expect(first[0]!.id).toBe(revised[0]!.id);
  expect(revised[0]!.speakerEvidenceFinal).toBe(true);
  expect(revised.at(-1)!.speakerId).toBeUndefined();
  expect(delayedNames([{ ...segment('Something completely different.'), isFinal: false }], local).some((piece) => piece.speakerId)).toBe(false);
});

it('distinguishes repeated wording on opposite sides of an independently matched passage', () => {
  const phrase = 'please leave the green folder here';
  const context = 'we can review every document together';
  const original = `${phrase} today. ${context} tomorrow. ${phrase}!`;
  const local = [segment(`${phrase} yesterday.`, 'first', true), segment(`${context} later.`, 'context'),
    { ...segment(phrase, 'last', true), speakerId: 'second', speakerName: 'Second test' }];
  const result = delayedNames([segment(original)], local);
  expect(text(result)).toBe(original);
  expect(result.filter((part) => part.speakerId).map((part) => [part.text.trim(), part.speakerId]))
    .toEqual([[phrase, 'voice'], [`${phrase}!`, 'second']]);
});

it('does not resolve repetitions that remain ambiguous within the same context interval', () => {
  const phrase = 'please leave the green folder here';
  const context = 'we can review every document together';
  const original = `${phrase} today. ${phrase} today. ${context}`;
  const result = delayedNames([segment(original)], [segment(`${phrase} yesterday.`, 'first', true), segment(context, 'context')]);
  expect(text(result)).toBe(original);
  expect(result.some((part) => part.speakerId)).toBe(false);
});

it('does not move a repeated name across context or assign unknown or unfinished local speech', () => {
  const phrase = 'please leave the green folder here';
  const context = 'we can review every document together';
  const original = `${phrase} today. ${context} tomorrow. ${phrase}`;
  for (const ending of [segment(phrase, 'last'), { ...segment(phrase, 'last', true), isFinal: false }]) {
    const result = delayedNames([segment(original)], [segment(`${phrase} yesterday.`, 'first', true), segment(`${context} later.`, 'context'), ending]);
    expect(text(result)).toBe(original);
    expect(result.filter((part) => part.speakerId).map((part) => part.text.trim())).toEqual([phrase]);
    expect(result.at(-1)!.speakerId).toBeUndefined();
  }
});

it('keeps the earlier occurrence when browser repetition arrives before local evidence', () => {
  const phrase = 'please leave the green folder here';
  const context = 'we can review every document together';
  const original = `${phrase} today. ${context} tomorrow. ${phrase}`;
  const local = [segment(`${phrase} yesterday.`, 'first', true), segment(`${context} later.`, 'context')];
  const result = delayedNames([{ ...segment(original), isFinal: false }], local);
  expect(text(result)).toBe(original);
  expect(result.filter((part) => part.speakerId).map((part) => part.text.trim())).toEqual([phrase]);
  expect(result.every((part) => !part.isFinal)).toBe(true);
  expect(result.at(-1)!.speakerId).toBeUndefined();
  // Removing distinguishing context in a browser revision withdraws the estimate.
  expect(delayedNames([segment(`${phrase} ${phrase}`)], local).some((part) => part.speakerId)).toBe(false);
});
