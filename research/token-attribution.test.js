import { describe, it, expect } from 'vitest';
import { attributeTokenPoint } from './token-attribution.mjs';

const token = { clockId: 'capture', sample: 32000 };
const windows = [0, 24000].map((startSample) => ({ clockId: 'capture', startSample, endSample: startSample + 48000, speakerId: 'A' }));
describe('delayed token attribution', () => {
  it('waits for subsequent evidence before committing a name', () => {
    expect(attributeTokenPoint(token, windows, 72000)).toEqual({ state: 'pending' });
    expect(attributeTokenPoint(token, windows, 80000)).toEqual({ state: 'matched', speakerId: 'A' });
  });
  it('keeps conflicting or unknown evidence unassigned', () => {
    for (const speakerId of ['B', undefined]) expect(attributeTokenPoint(token, [windows[0], { ...windows[1], speakerId }], 80000)).toEqual({ state: 'unknown' });
  });
  it('rejects a single window and duplicate evidence, including the end of capture', () => {
    expect(attributeTokenPoint(token, [windows[0]], 48000, true)).toEqual({ state: 'unknown' });
    expect(attributeTokenPoint(token, [windows[0], windows[0]], 80000)).toEqual({ state: 'unknown' });
  });
  it('does not combine other capture clocks or future/unbounded windows', () => {
    expect(attributeTokenPoint({ ...token, clockId: 'other' }, windows, 80000)).toEqual({ state: 'unknown' });
    for (const replacement of [{ endSample: 90000 }, { startSample: -100 }, { endSample: 48001 }]) {
      expect(attributeTokenPoint(token, [windows[0], { ...windows[1], ...replacement }], 80000)).toEqual({ state: 'unknown' });
    }
  });
});
