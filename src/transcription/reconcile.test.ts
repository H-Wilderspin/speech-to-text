import { describe, expect, it } from 'vitest';
import { reconcileResults } from './reconcile';
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
});
