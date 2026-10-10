import { describe, expect, it } from 'vitest';
import { collapseCumulativeResults, reconcileResults } from './reconcile';
import type { RecognitionResult } from './types';

function result(text: string, isFinal = false): RecognitionResult {
  return { 0: { transcript: text, confidence: .7 }, length: 1, isFinal };
}

describe('complete recognition snapshots', () => {
  it('replaces interim words and promotes them without duplication', () => {
    const first = reconcileResults([], [result('a blue')], 1);
    const revised = reconcileResults(first, [result('a new day', true)], 1);
    expect(revised).toEqual([{ id: '1:0', text: 'a new day', isFinal: true }]);
    expect(reconcileResults(revised, [result('a new day', true)], 1)).toEqual(revised);
  });
  it('removes vanished interim slots without retracting confirmed text', () => {
    const previous = reconcileResults([], [result('Stable.', true), result('maybe'), result('later')], 2);
    expect(reconcileResults(previous, [result('Changed.', true)], 2)).toEqual([previous[0]]);
    expect(reconcileResults(previous, [], 2)).toEqual([previous[0]]);
  });
  it('keeps final text while the next phrase changes', () => {
    const previous = reconcileResults([], [result('First.', true), result('s')], 3);
    const next = reconcileResults(previous, [result('First.', true), result('Second.', true), result('third')], 3);
    expect(next.map((segment) => segment.text)).toEqual(['First.', 'Second.', 'third']);
    expect(next[0]).toBe(previous[0]);
  });
  it('ignores empty alternatives and does not invent timing or identity', () => {
    const next = reconcileResults([], [result('  '), result(' hello ')], 1);
    expect(next).toEqual([{ id: '1:1', text: 'hello', isFinal: false }]);
  });
  it('collapses a growing phrase reported in successive final slots in one utterance', () => {
    let segments = reconcileResults([], [result('We', true)], 1, true);
    segments = reconcileResults(segments, [result('We', true), result('We are', true)], 1, true);
    segments = reconcileResults(segments, [result('We', true), result('We are', true), result('We are here.', true)], 1, true);
    expect(collapseCumulativeResults(segments).map((segment) => segment.text)).toEqual(['We are here.']);
  });
  it('accepts cumulative extensions to a prematurely final single slot', () => {
    const first = reconcileResults([], [result('We are', true)], 1, true);
    expect(reconcileResults(first, [result('we are here.', true)], 1, true).map((segment) => segment.text)).toEqual(['we are here.']);
  });
  it('preserves deliberate repeated words and independent repeated phrases', () => {
    const segments = reconcileResults([], [result('Very very good.', true), result('Very very good.', true), result('Good evening.', true)], 1, true);
    expect(segments.map((segment) => segment.text)).toEqual(['Very very good.', 'Very very good.', 'Good evening.']);
  });
});
