import { afterEach, expect, it, vi } from 'vitest';
import { startAudioCapture, type AudioFrame } from './streaming';

function fixture(latePermission = false) {
  vi.useFakeTimers();
  const track = { stop: vi.fn(), onended: null, onmute: null };
  const stream = { getTracks: () => [track] };
  let allow!: () => void;
  const permission = latePermission ? new Promise<typeof stream>((resolve) => { allow = () => resolve(stream); }) : Promise.resolve(stream);
  const port = { postMessage: vi.fn(), onmessage: null as null | ((event: { data: object }) => void), close: vi.fn() };
  const close = vi.fn(async () => {});
  const context = { sampleRate: 16000, state: 'running', onstatechange: null,
    resume: async () => {}, close, audioWorklet: { addModule: async () => {} },
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }), destination: {} };
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => permission } });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal('AudioContext', class { constructor() { return context; } });
  vi.stubGlobal('AudioWorkletNode', class { port = port; connect() {} disconnect() {} });
  return { track, port, close, allow, send: (data: object) => port.onmessage?.({ data }) };
}
async function prepared() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('stops the microphone once, drains consumed samples and then resolves Stop', async () => {
  const f = fixture(); let finishProcessing!: () => void; let consumed: AudioFrame | undefined;
  const capture = startAudioCapture(new AbortController().signal, (frame) => {
    consumed = frame; return new Promise<void>((resolve) => { finishProcessing = resolve; });
  });
  await prepared();
  const samples = new Float32Array(1600).fill(.1);
  f.send({ type: 'frame', samples, startSample: 0 });
  capture.stop(); f.send({ type: 'end', totalSamples: 1600 });
  expect(f.track.stop).toHaveBeenCalledTimes(1);
  expect(f.close).not.toHaveBeenCalled();
  expect(consumed).toMatchObject({ sampleRate: 16000, startSample: 0 });
  expect(consumed?.clockId).toBeTruthy();
  finishProcessing(); await capture.done;
  expect(f.track.stop).toHaveBeenCalledTimes(1); expect(f.close).toHaveBeenCalledTimes(1);
  expect(samples.every((sample) => sample === 0)).toBe(true);
});
it('rejects a discontinuous sample clock and erases queued and active audio', async () => {
  const f = fixture();
  const capture = startAudioCapture(new AbortController().signal, () => new Promise(() => {}));
  const rejected = expect(capture.done).rejects.toThrow('lost continuity'); await prepared();
  const samples = [new Float32Array(1600).fill(.1), new Float32Array(1600).fill(.2)];
  f.send({ type: 'frame', samples: samples[0], startSample: 0 });
  f.send({ type: 'frame', samples: samples[1], startSample: 3200 });
  await rejected;
  expect(samples.every((frame) => frame.every((sample) => sample === 0))).toBe(true);
  expect(f.track.stop).toHaveBeenCalledTimes(1);
});
it('releases a microphone granted after cancellation without starting a worklet', async () => {
  const f = fixture(true); const controller = new AbortController();
  const consume = vi.fn(async () => {}); const capture = startAudioCapture(controller.signal, consume);
  const rejected = expect(capture.done).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await rejected; f.allow(); await prepared();
  expect(f.track.stop).toHaveBeenCalledTimes(1); expect(consume).not.toHaveBeenCalled();
  expect(f.port.onmessage).toBeNull();
});
it('fails a stalled input and releases its microphone', async () => {
  const f = fixture(); const capture = startAudioCapture(new AbortController().signal, async () => {});
  const rejected = expect(capture.done).rejects.toThrow('No audio arrived'); await prepared();
  await vi.advanceTimersByTimeAsync(2000); await rejected;
  expect(f.track.stop).toHaveBeenCalledTimes(1);
});
it('bounds Stop draining time when processing never settles', async () => {
  const f = fixture(); const capture = startAudioCapture(new AbortController().signal, () => new Promise(() => {}));
  const rejected = expect(capture.done).rejects.toThrow('did not finish'); await prepared();
  const samples = new Float32Array(1600).fill(.1); f.send({ type: 'frame', samples, startSample: 0 });
  capture.stop(); f.send({ type: 'end', totalSamples: 1600 });
  await vi.advanceTimersByTimeAsync(5000); await rejected;
  expect(samples.every((sample) => sample === 0)).toBe(true); expect(f.track.stop).toHaveBeenCalledTimes(1);
});
