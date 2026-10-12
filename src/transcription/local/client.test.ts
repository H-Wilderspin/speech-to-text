import { afterEach, expect, it, vi } from 'vitest';
import { LocalWorker } from './client';

function fixture() {
  vi.useFakeTimers(); vi.stubGlobal('location', { search: '?debugSpeakers=1' });
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const worker = { onmessage: null as null | ((event: { data: { id: number } }) => void), onerror: null,
    postMessage: vi.fn(), terminate: vi.fn() };
  vi.stubGlobal('Worker', class { constructor() { return worker; } });
  const client = new LocalWorker();
  const frame = { clockId: 'private-clock', sampleRate: 16000 as const, startSample: 0, samples: new Float32Array(1600) };
  return { client, worker, log, frame, signal: new AbortController().signal };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('allows the next frame after each response, without waiting for a completed sentence', async () => {
  const f = fixture();
  const first = f.client.request({ type: 'frame', frame: f.frame }, f.signal);
  await expect(f.client.request({ type: 'frame', frame: f.frame }, f.signal)).rejects.toThrow('busy');
  f.worker.onmessage?.({ data: { id: 1 } }); await first;
  const second = f.client.request({ type: 'frame', frame: { ...f.frame, startSample: 1600 } }, f.signal);
  f.worker.onmessage?.({ data: { id: 2 } }); await second;
  expect(f.worker.postMessage).toHaveBeenCalledTimes(2);
  expect(f.worker.terminate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1500);
  expect(f.log.mock.calls.some(([stage]) => String(stage).includes('waiting'))).toBe(false);
  f.client.dispose();
});

it('reports an unsampled stalled request and its timeout, without logging frame contents', async () => {
  const f = fixture();
  const pending = f.client.request({ type: 'frame', frame: { ...f.frame, startSample: 1600 } }, f.signal);
  const rejected = expect(pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.log).toHaveBeenCalledWith(expect.stringMatching(/worker\.frame-waiting .*"request":1,"startSample":1600/));
  await vi.advanceTimersByTimeAsync(9000); await rejected;
  expect(f.log).toHaveBeenCalledWith(expect.stringMatching(/worker\.timeout .*"request":1/));
  expect(JSON.stringify(f.log.mock.calls)).not.toContain('private-clock');
  expect(JSON.stringify(f.log.mock.calls)).not.toContain('samples');
  expect(f.worker.terminate).toHaveBeenCalledOnce();
});
