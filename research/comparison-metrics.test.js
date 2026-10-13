import { describe, it, expect } from 'vitest';
import { timelineIdentity, scoreWords } from './comparison-metrics.mjs';
describe('comparison scoring', () => {
  it('never fills a gap or overlap with the nearest speaker', () => {
    const turns = [{ start: 1, end: 2, cluster: 0 }, { start: 3, end: 4, cluster: 0 }];
    expect(timelineIdentity({ start: 1.5, end: 3.5 }, turns, { 0: 'A' })).toBeUndefined();
    expect(timelineIdentity({ start: 1.5, end: 2 }, turns, { 0: 'A' })).toBe('A');
    expect(timelineIdentity({ start: 2 }, turns, { 0: 'A' })).toBeUndefined();
    expect(timelineIdentity({ start: 1.5, end: 2 }, [...turns, { start: 1.8, end: 2.5, cluster: 1 }], { 0: 'A', 1: 'B' })).toBeUndefined();
    expect(timelineIdentity({ start: 1.5 }, turns, {})).toBeUndefined();
  });
  it('counts repeated phrases separately and penalizes dropped endings', () => {
    const reference = [0, 1].flatMap((utterance) => ['cup', 'of', 'tea'].map((text) => ({ text, utterance, speakerId: 'A' })));
    const hypothesis = ['cup', 'of', 'tea', 'cup', 'of'].map((text) => ({ text, speakerId: 'A' }));
    expect(scoreWords(reference, hypothesis)).toMatchObject({ edits: 1, knownWords: 6, correctlyNamedWords: 5, completeCorrectKnownUtterances: 1, correctClosingWords: 1 });
  });
  it('reports false identity on substitutions and named insertions', () => {
    expect(scoreWords([{ text: 'hello' }], [{ text: 'yellow', speakerId: 'A' }, { text: 'there', speakerId: 'A' }])).toMatchObject({ edits: 2, falseNamesOnUnknownAlignedWords: 1, unalignedNamedInsertions: 1 });
  });
});
