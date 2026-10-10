import { expect, it } from 'vitest';
import { inspectTiming, readMonoWav, measureStream } from './asr-streaming.mjs';

it('scores a complete fixture even when the recognizer splits it into endpoints', () => {
  let segment = 0;
  const results = ['a blue', 'sky', ''];
  const recognizer = {
    Module: { HEAPU8: new Uint8Array(1) },
    createStream: () => ({ handle: 1, acceptWaveform() {}, inputFinished() {}, free() {} }),
    isReady: () => false,
    getResult: () => ({ text: results[segment], tokens: [], timestamps: [], start_time: 0, segment }),
    isEndpoint: () => true,
    reset: () => { segment++; },
  };
  const report = measureStream(recognizer, new Float32Array(3200), 'a blue sky');
  expect(report.finals).toHaveLength(2);
  expect(report.wordErrors).toEqual({ referenceWords: 3, recognizedWords: 3, edits: 0, errorRate: 0 });
  expect(JSON.stringify(report)).not.toContain('a blue');
});

it('maps segment-relative token points onto the supplied audio clock', () => {
  const result = inspectTiming({ start_time: 5, segment: 1, timestamps: [.2, .4], tokens: ['a', 'b'] }, 16000 * 6);
  expect(result).toEqual({ startSeconds: 5, segment: 1, tokenCount: 2, firstTokenSeconds: 5.2, lastTokenSeconds: 5.4 });
  expect(result).not.toHaveProperty('endSeconds');
});
it('accepts legacy string timestamps but rejects absent, non-monotonic or future timing', () => {
  const valid = { start_time: 0, segment: 0, timestamps: '[0.1, 0.2]', tokens: ['a', 'b'] };
  expect(inspectTiming(valid, 16000).tokenCount).toBe(2);
  for (const change of [{ timestamps: undefined }, { timestamps: [.2, .1] }, { timestamps: [.1, 2] },
    { timestamps: [NaN, .2] }, { start_time: -1 }, { segment: -1 }, { tokens: [] }]) {
    expect(() => inspectTiming({ ...valid, ...change }, 16000)).toThrow();
  }
});
it('reads actual PCM16 sample values and rejects incompatible or truncated fixtures', () => {
  const bytes = new Uint8Array(48); const view = new DataView(bytes.buffer);
  const text = (offset, value) => bytes.set(new TextEncoder().encode(value), offset);
  text(0, 'RIFF'); view.setUint32(4, 40, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, 4, true);
  view.setInt16(44, -16384, true); view.setInt16(46, 16384, true);
  expect(Array.from(readMonoWav(bytes))).toEqual([-.5, .5]);
  expect(() => readMonoWav(bytes.subarray(0, 47))).toThrow();
  view.setUint16(22, 2, true); expect(() => readMonoWav(bytes)).toThrow();
});
