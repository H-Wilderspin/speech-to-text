import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

function fixture() {
  const messages: { type: string; startSample?: number; totalSamples?: number; samples?: Float32Array; message?: string }[] = [];
  const port = { onmessage: (event: { data: object }) => { void event; }, postMessage: (message: (typeof messages)[number], transfer: ArrayBuffer[] = []) => messages.push(structuredClone(message, { transfer })) };
  let Recorder!: new () => { process(inputs: Float32Array[][]): boolean; samples: Float32Array };
  const scope = { AudioWorkletProcessor: class { port = port; }, sampleRate: 16000, currentFrame: 0,
    registerProcessor: (_name: string, constructor: typeof Recorder) => { Recorder = constructor; } };
  runInNewContext(readFileSync(new URL('./stream-worklet.js', import.meta.url), 'utf8'), scope);
  const recorder = new Recorder();
  const feed = (count: number) => {
    const samples = Float32Array.from({ length: count }, (_, i) => (scope.currentFrame + i) / 16000);
    const result = recorder.process([[samples]]); scope.currentFrame += count; return result;
  };
  return { messages, port, recorder, scope, feed };
}

it('preserves sample order across render quanta and flushes the final partial frame on Stop', () => {
  const f = fixture();
  for (const count of [128, 256, 128, 2048, 128]) f.feed(count);
  f.port.onmessage({ data: { type: 'stop' } });
  const frames = f.messages.filter((message) => message.type === 'frame');
  expect(frames.map((frame) => [frame.startSample, frame.samples?.length])).toEqual([[0, 1600], [1600, 1088]]);
  const samples = frames.flatMap((frame) => Array.from(frame.samples!));
  expect(samples).toEqual(Array.from(Float32Array.from({ length: 2688 }, (_, i) => i / 16000)));
  expect(f.messages.at(-1)).toEqual({ type: 'end', totalSamples: 2688 });
  expect(f.feed(128)).toBe(false);
});
it('bounds stalled consumer memory and fails instead of silently dropping frames', () => {
  const f = fixture();
  for (let i = 0; i < 8; i++) expect(f.feed(1600)).toBe(true);
  expect(f.feed(1600)).toBe(false);
  expect(f.messages.filter((message) => message.type === 'frame')).toHaveLength(8);
  expect(f.messages.at(-1)?.message).toContain('could not keep up');
  expect(f.recorder.samples.every((sample) => sample === 0)).toBe(true);
});
it('waits for a processing acknowledgement before flushing a full queue on Stop', () => {
  const f = fixture(); for (let i = 0; i < 8; i++) f.feed(1600); f.feed(128);
  f.port.onmessage({ data: { type: 'stop' } });
  expect(f.messages).toHaveLength(8);
  f.port.onmessage({ data: { type: 'ack', startSample: 0 } });
  expect(f.messages.at(-2)?.samples?.length).toBe(128);
  expect(f.messages.at(-1)).toEqual({ type: 'end', totalSamples: 12928 });
});
it('rejects interrupted render clocks, disappearing input, invalid samples and wrong sample rates', () => {
  const gap = fixture(); gap.feed(128); gap.scope.currentFrame += 128;
  expect(gap.feed(128)).toBe(false);
  const missing = fixture(); missing.feed(128); expect(missing.recorder.process([])).toBe(false);
  const invalid = fixture(); expect(invalid.recorder.process([[new Float32Array([NaN])]])).toBe(false);
  const rate = fixture(); rate.scope.sampleRate = 48000; expect(rate.feed(128)).toBe(false);
});
it('releases capacity only for a valid acknowledgement and erases unfinished audio on cancel', () => {
  const f = fixture(); f.feed(1600); f.port.onmessage({ data: { type: 'ack', startSample: 0 } });
  f.port.onmessage({ data: { type: 'ack', startSample: 0 } });
  expect(f.messages.at(-1)?.type).toBe('error');
  const cancel = fixture(); cancel.feed(128); cancel.port.onmessage({ data: { type: 'cancel' } });
  expect(cancel.recorder.samples.every((sample) => sample === 0)).toBe(true);
  expect(cancel.feed(128)).toBe(false); expect(cancel.messages).toHaveLength(0);
});
