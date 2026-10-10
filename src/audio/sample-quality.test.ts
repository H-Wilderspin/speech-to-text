import { expect, it } from 'vitest';
import { checkRecording } from './sample-quality';

it('rejects incomplete, silent, non-finite and heavily clipped recordings', () => {
  for (const sample of [new Float32Array(100), new Float32Array(48000), new Float32Array(48000).fill(NaN), new Float32Array(48000).fill(1)]) {
    expect(() => checkRecording(sample)).toThrow();
  }
});
it('accepts a bounded audible signal without claiming it is speech', () => {
  expect(() => checkRecording(Float32Array.from({ length: 128000 }, (_, i) => .1 * Math.sin(i / 8)))).not.toThrow();
});
