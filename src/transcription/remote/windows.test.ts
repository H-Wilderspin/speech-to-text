import { describe, expect, it } from 'vitest';
import { AudioWindows, type AudioWindow } from './windows';

describe('comparison audio windows', () => {
  it('retains context while owning every sample once, including the stopped tail', () => {
    const jobs: AudioWindow[] = [];
    const buffer = new AudioWindows((job) => jobs.push(job));
    for (let i = 0; i < 470; i++) {
      const samples = new Float32Array(1600).fill(i);
      buffer.add({ clockId: 'one', sampleRate: 16000, startSample: i * 1600, samples });
      samples.fill(0); // The capture adapter erases each delivered frame.
    }
    buffer.finish(); buffer.finish();
    expect(jobs.map((j) => [j.startSample / 16000, j.acceptFrom / 16000, j.acceptUntil / 16000, j.samples.length / 16000]))
      .toEqual([[0, 0, 22, 24], [20, 22, 42, 24], [40, 42, 47, 7]]);
    expect(jobs[1]!.samples[0]).toBe(200);
    expect(jobs[2]!.samples.at(-1)).toBe(469);
  });
  it('flushes a short recording and rejects discontinuities instead of inventing timing', () => {
    const jobs: AudioWindow[] = [];
    const buffer = new AudioWindows((job) => jobs.push(job));
    buffer.add({ clockId: 'a', sampleRate: 16000, startSample: 0, samples: new Float32Array(1600) });
    expect(() => buffer.add({ clockId: 'a', sampleRate: 16000, startSample: 2000, samples: new Float32Array(1600) })).toThrow(/clock/);
    buffer.finish(); expect(jobs[0]!.acceptUntil).toBe(1600);
  });
  it('does not dispatch audio on cancellation', () => {
    const jobs: AudioWindow[] = [];
    const buffer = new AudioWindows((job) => jobs.push(job));
    buffer.add({ clockId: 'a', sampleRate: 16000, startSample: 0, samples: new Float32Array(1600) });
    buffer.erase(); buffer.finish(); expect(jobs).toHaveLength(0);
  });
});
