import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

function fixture(seconds?: number, rate = 16000) {
  const messages: { samples?: Float32Array; seconds?: number }[] = [];
  const port = { onmessage: () => {}, postMessage: (message: (typeof messages)[number], transfer: ArrayBuffer[] = []) => messages.push(structuredClone(message, { transfer })) };
  let Recorder!: new (options: object) => { process(inputs: Float32Array[][]): boolean; samples: Float32Array };
  runInNewContext(readFileSync(new URL('./enrolment-worklet.js', import.meta.url), 'utf8'), {
    AudioWorkletProcessor: class { port = port; }, sampleRate: rate,
    registerProcessor: (_name: string, constructor: typeof Recorder) => { Recorder = constructor; },
  });
  return { messages, port, recorder: new Recorder({ processorOptions: { durationSeconds: seconds } }) };
}

it('captures all twenty seconds at native rates while comparisons retain their eight-second default', () => {
  for (const [seconds, rate] of [[20, 16000], [20, 44100], [20, 48000], [undefined, 16000]] as const) {
    const f = fixture(seconds, rate); const length = (seconds ?? 8) * rate;
    for (let offset = 0; offset < length; offset += 128) {
      expect(f.recorder.process([[new Float32Array(128).fill(.1)]])).toBe(offset + 128 < length);
    }
    expect(f.messages.at(-1)?.samples?.length).toBe(length);
    expect(f.messages.at(-1)?.samples?.every((sample) => sample > 0)).toBe(true);
    expect(f.messages.some((message) => (message.seconds ?? 0) > (seconds ?? 8) - 1)).toBe(true);
  }
});

it('erases cancelled audio without returning a partial profile and rejects invalid durations', () => {
  const f = fixture(20); f.recorder.process([[new Float32Array(128).fill(.1)]]);
  f.port.onmessage(); expect(f.recorder.process([])).toBe(false);
  expect(f.recorder.samples.every((sample) => sample === 0)).toBe(true);
  expect(f.messages.some((message) => message.samples)).toBe(false);
  for (const seconds of [0, 2, 31, NaN, Infinity, 20.5]) expect(() => fixture(seconds)).toThrow('Invalid recording duration');
});
