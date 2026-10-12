import { afterEach, expect, it, vi } from 'vitest';
import { createSpeakerTrace, speakerDiagnosticsEnabled, speakerFailureStage, type DiagnosticCounts } from './diagnostics';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const payload = (line: unknown) => JSON.parse(String(line).slice(String(line).indexOf('{')));

it('requires an explicit debug URL and is silent by default', () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.stubGlobal('location', { search: '' });
  createSpeakerTrace('test')('received', { frames: 1 });
  expect(log).not.toHaveBeenCalled();
  vi.stubGlobal('location', { search: '?debugSpeakers=1' });
  expect(speakerDiagnosticsEnabled()).toBe(true);
  createSpeakerTrace('test')('received', { frames: 2 });
  expect(log).toHaveBeenCalledWith(expect.stringContaining('[who-said-what] test.received {'));
  expect(payload(log.mock.calls[0]?.[0])).toMatchObject({ frames: 2 });
});

it('copies only finite numeric, boolean and null fields and throttles per trace and stage', () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const time = vi.spyOn(performance, 'now').mockReturnValue(0);
  const trace = createSpeakerTrace('test', true);
  const unsafe = { count: 1, busy: true, score: null, text: 'private speech', name: 'private name',
    audio: new Float32Array([.3]), embedding: [1, 0], invalid: Infinity } as unknown as DiagnosticCounts;
  trace('received', unsafe, 1000);
  expect(log.mock.calls[0]).toHaveLength(1);
  expect(payload(log.mock.calls[0]?.[0])).toEqual({ trace: expect.any(Number), atMs: 0, count: 1, busy: true, score: null });
  unsafe.count = 4;
  trace('received', { count: 2 }, 1000);
  trace('failed', { count: 2 });
  expect(log).toHaveBeenCalledTimes(2);
  time.mockReturnValue(1000); trace('received', { count: 3 }, 1000);
  expect(log).toHaveBeenCalledTimes(3);
  expect(payload(log.mock.calls[0]?.[0])).toHaveProperty('count', 1);
  expect(speakerFailureStage(new Error('private speech'))).toBe('failed');
  expect(speakerFailureStage(new Error('The audio clock was interrupted.'))).toBe('clock-interrupted');
});
