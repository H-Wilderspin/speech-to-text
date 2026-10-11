import { afterEach, expect, it, vi } from 'vitest';
import { LocalEngine } from './engine';
import type { LocalProcessor } from './client';
import type { LocalResponse } from './types';
import type { AudioFrame, startAudioCapture } from '../../audio/streaming';
import { CONSENT_VERSION, type ProfileStore, type SpeakerProfile } from '../../storage/profiles';
import { speakerModel } from '../../identification/model';
import { notifyProfileChange } from '../../storage/profile-changes';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function fixture() {
  vi.stubGlobal('isSecureContext', true); vi.stubGlobal('AudioContext', class {}); vi.stubGlobal('AudioWorkletNode', class {});
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia() {} } }); vi.stubGlobal('BroadcastChannel', undefined);
  const events = new EventTarget();
  vi.stubGlobal('addEventListener', events.addEventListener.bind(events)); vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events)); vi.stubGlobal('dispatchEvent', events.dispatchEvent.bind(events));
  const profile: SpeakerProfile = { schemaVersion: 1, id: 'test', displayName: 'Test', embedding: new Array(192).fill(.1),
    modelVersion: speakerModel.version, createdAt: '2026-01-01', consentedAt: '2026-01-01', consentVersion: CONSENT_VERSION, sampleDurationMs: 8000 };
  const store: ProfileStore = { list: vi.fn(async () => [profile]), read: vi.fn(async () => profile), close: vi.fn(),
    save: vi.fn(), remove: vi.fn(), clear: vi.fn() };
  let nextResponse: LocalResponse = { id: 1 };
  const requests: Parameters<LocalProcessor['request']>[0][] = [];
  const processor: LocalProcessor = { request: vi.fn(async (data) => { requests.push(data); return data.type === 'frame' ? nextResponse : { id: 1 }; }), dispose: vi.fn() };
  const loader = vi.fn(async () => ({}));
  let consume!: (frame: AudioFrame) => Promise<void>; let ready!: () => void; let resolve!: () => void; let reject!: (reason: unknown) => void;
  let signal!: AbortSignal;
  const stop = vi.fn(() => resolve());
  const capture: typeof startAudioCapture = vi.fn((inputSignal, consumer, callback) => {
    signal = inputSignal; consume = consumer; ready = callback!;
    const done = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    return { done, stop };
  });
  const engine = new LocalEngine('https://example.com/app/', () => store, processor, capture, loader);
  return { engine, store, profile, processor, requests, loader, capture, stop, ready: () => ready(), reject: (error: Error) => reject(error),
    signal: () => signal, send: (response: LocalResponse) => { nextResponse = response; return consume({ clockId: 'test', startSample: 0, sampleRate: 16000, samples: new Float32Array(1600) }); } };
}

it('loads saved references, replaces provisional text, stops by command and erases temporary vectors', async () => {
  const f = fixture(); await f.engine.prepare(); f.engine.start('en-GB'); await flush(); f.ready();
  expect(f.profile.embedding.every((value) => value === 0)).toBe(true);
  expect(f.requests.find((request) => request.type === 'start')?.references?.[0]?.embedding.every((value) => value === 0)).toBe(true);
  expect(f.store.close).toHaveBeenCalledOnce();
  await f.send({ id: 1, segments: [{ id: 'one', text: 'HELLO', isFinal: false }] });
  await f.send({ id: 2, segments: [{ id: 'one', text: 'HELLO THERE', isFinal: true, speakerId: 'test', speakerName: 'Test', speakerEstimated: true }], commandStop: true });
  await flush();
  expect(f.engine.getSnapshot()).toMatchObject({ phase: 'idle', message: 'Stopped by voice command.', segments: [{ text: 'HELLO THERE', speakerEstimated: true }] });
  expect(f.stop).toHaveBeenCalledOnce(); expect(f.engine.getPreparationSnapshot().phase).toBe('ready');
  expect(f.requests.filter((request) => request.type === 'finish')).toHaveLength(1);
  f.engine.dispose();
});

it('cancels a pending permission request and ignores late callbacks', async () => {
  const f = fixture(); await f.engine.prepare(); f.engine.start('en-GB'); f.engine.stop(); await flush(); f.ready();
  expect(f.signal().aborted).toBe(true); expect(f.processor.dispose).toHaveBeenCalled();
  expect(f.engine.getSnapshot().phase).toBe('idle'); expect(f.engine.getPreparationSnapshot().phase).toBe('idle'); f.engine.dispose();
});

it('releases capture on missing profiles, storage failure, and capture failure', async () => {
  for (const reason of ['empty', 'storage', 'capture']) {
    const f = fixture();
    if (reason === 'empty') vi.mocked(f.store.list).mockResolvedValue([]);
    if (reason === 'storage') vi.mocked(f.store.list).mockRejectedValue(new Error('Storage blocked'));
    await f.engine.prepare(); f.engine.start('en-GB'); if (reason === 'capture') f.reject(new Error('Microphone denied')); await flush();
    expect(f.engine.getSnapshot().phase).toBe('error'); expect(f.signal().aborted).toBe(true);
    expect(f.processor.dispose).toHaveBeenCalled(); expect(f.store.close).toHaveBeenCalled(); f.engine.dispose();
  }
});

it('discards provisional text on interruption and requires cached preparation again', async () => {
  const f = fixture(); await f.engine.prepare(); f.engine.start('en-GB'); await flush(); f.ready();
  await f.send({ id: 1, segments: [{ id: 'one', text: 'UNFINISHED', isFinal: false }] });
  f.engine.interrupt(); await flush();
  expect(f.signal().aborted).toBe(true); expect(f.engine.getSnapshot().segments).toEqual([]);
  await f.engine.prepare(true); expect(f.loader).toHaveBeenLastCalledWith('https://example.com/app/', true, expect.any(AbortSignal)); f.engine.dispose();
});

it('does not open a microphone for an unsupported language or unprepared model', async () => {
  const f = fixture(); f.engine.start('en-GB'); expect(f.capture).not.toHaveBeenCalled();
  await f.engine.prepare(); f.engine.start('fr-FR'); expect(f.capture).not.toHaveBeenCalled();
  expect(f.engine.getSnapshot().message).toContain('English'); f.engine.dispose();
});

it('invalidates active references when the profile store changes, with app-path isolation', async () => {
  const f = fixture(); await f.engine.prepare(); f.engine.start('en-GB'); await flush(); f.ready();
  notifyProfileChange('speech-to-text-speakers:/different/'); expect(f.signal().aborted).toBe(false);
  notifyProfileChange('speech-to-text-speakers:/app/'); await flush();
  expect(f.signal().aborted).toBe(true); expect(f.processor.dispose).toHaveBeenCalled();
  expect(f.engine.getSnapshot().message).toContain('Saved speakers changed'); f.engine.dispose();
});

it('cancels preparation without accepting stale success or starting a microphone', async () => {
  const f = fixture(); let resolve!: (value: object) => void;
  f.loader.mockImplementation(() => new Promise((yes) => { resolve = yes; }));
  const preparing = f.engine.prepare(); f.engine.cancelPreparation(); resolve({}); await preparing;
  expect(f.engine.getPreparationSnapshot().phase).toBe('idle'); expect(f.processor.request).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
  f.engine.dispose();
});
