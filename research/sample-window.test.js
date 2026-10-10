import { expect, it } from 'vitest';
import { SampleWindow } from './sample-window.mjs';
it('keeps the exact latest samples across wraparound and arbitrary chunk lengths', () => {
  const window = new SampleWindow(5); const input = Float32Array.from({ length: 19 }, (_, i) => i / 19);
  window.push(input.subarray(0, 3), 0); expect(window.latest()).toBeUndefined();
  window.push(input.subarray(3, 11), 3);
  expect(window.latest()).toEqual({ startSample: 6, endSample: 11, samples: input.slice(6, 11) });
  window.push(input.subarray(11), 11);
  expect(window.latest()).toEqual({ startSample: 14, endSample: 19, samples: input.slice(14) });
  expect(window.samples.length).toBe(5);
});
it('rejects gaps and erases retained audio on close', () => {
  const window = new SampleWindow(5); window.push(new Float32Array([.1, .2]), 0);
  expect(() => window.push(new Float32Array([.3]), 3)).toThrow('continuity');
  expect(() => window.push(new Float32Array([NaN]), 2)).toThrow('continuity');
  window.close(); expect(window.samples.every((sample) => sample === 0)).toBe(true);
  expect(window.latest()).toBeUndefined(); expect(() => window.push(new Float32Array([.3]), 2)).toThrow();
});
