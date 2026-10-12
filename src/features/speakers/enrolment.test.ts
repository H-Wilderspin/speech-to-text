import { describe, expect, it, vi } from 'vitest';
import { EnrolmentSession } from './enrolment';
import { CONSENT_VERSION, type ProfileStore, type SpeakerProfile } from '../../storage/profiles';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup() {
  const samples = new Float32Array(320000).fill(.1);
  const embedding = new Float32Array(192).fill(.1);
  const recorder = { record: vi.fn().mockResolvedValue(samples) };
  const engine = { prepare: vi.fn().mockResolvedValue(undefined), compute: vi.fn().mockResolvedValue(embedding), dispose: vi.fn() };
  const store: ProfileStore = { list: vi.fn().mockResolvedValue([]), read: vi.fn(), save: vi.fn().mockResolvedValue(undefined), remove: vi.fn(), clear: vi.fn(), close: vi.fn() };
  const session = new EnrolmentSession(recorder, engine, store);
  return { session, recorder, engine, store, samples, embedding };
}
describe('personal enrolment lifecycle', () => {
  it('requires preparation, a name before touching the microphone', async () => {
    const { session, recorder } = setup();
    await session.record('Test'); await session.prepare();
    await session.record(' ');
    expect(recorder.record).not.toHaveBeenCalled();
  });
  it('waits for durable save and erases audio and temporary embeddings afterward', async () => {
    const { session, store, samples, embedding } = setup();
    const save = deferred<void>(); vi.mocked(store.save).mockReturnValue(save.promise);
    await session.prepare(); const operation = session.record(' Test ');
    await vi.waitFor(() => expect(session.getSnapshot().phase).toBe('saving'));
    expect(session.getSnapshot().phase).not.toBe('saved'); save.resolve(); await operation;
    expect(session.getSnapshot().phase).toBe('saved');
    expect(samples.every((v) => v === 0)).toBe(true); expect(embedding.every((v) => v === 0)).toBe(true);
    expect(store.save).toHaveBeenCalledOnce();
    expect(vi.mocked(store.save).mock.calls[0]?.[0].sampleDurationMs).toBe(20000);
  });
  it('discards capture that resolves after cancellation without starting inference', async () => {
    const { session, recorder, engine, store, samples } = setup();
    const capture = deferred<Float32Array>(); recorder.record.mockReturnValue(capture.promise);
    await session.prepare(); const operation = session.record('Test'); session.cancel(); capture.resolve(samples); await operation;
    expect(engine.compute).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled();
    expect(samples.every((v) => v === 0)).toBe(true); expect(session.getSnapshot().phase).toBe('idle');
  });
  it('does not save an embedding delivered after cancellation or disposal', async () => {
    const { session, engine, store, embedding } = setup(); const inference = deferred<Float32Array>();
    engine.compute.mockReturnValue(inference.promise); await session.prepare(); const operation = session.record('Test');
    await vi.waitFor(() => expect(engine.compute).toHaveBeenCalled()); session.dispose(); inference.resolve(embedding); await operation;
    expect(store.save).not.toHaveBeenCalled(); expect(embedding.every((v) => v === 0)).toBe(true);
  });
  it('passes cancellation into storage and reports storage failure without claiming success', async () => {
    const { session, store, samples } = setup(); vi.mocked(store.save).mockRejectedValue(new Error('Storage full'));
    await session.prepare(); await session.record('Test');
    expect(session.getSnapshot()).toMatchObject({ phase: 'error', message: 'Storage full' });
    expect(samples.every((v) => v === 0)).toBe(true);
    expect(vi.mocked(store.save).mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });
  it('prevents duplicate operations and suppresses stale preparation results', async () => {
    const { session, engine } = setup(); const prepare = deferred<void>(); engine.prepare.mockReturnValue(prepare.promise);
    const operation = session.prepare(); await session.prepare(); session.cancel(); prepare.resolve(); await operation;
    expect(engine.prepare).toHaveBeenCalledOnce(); expect(session.getSnapshot().phase).toBe('idle');
  });
  it('replaces a selected voice while preserving its identity and legacy metadata', async () => {
    const f = setup();
    const old: SpeakerProfile = { schemaVersion: 1, id: 'existing', displayName: 'Test', createdAt: '2026-10-10T12:00:00Z',
      consentedAt: '2026-10-10T12:00:00Z', consentVersion: CONSENT_VERSION, modelVersion: 'old', sampleDurationMs: 8000, embedding: [1, 0] };
    vi.mocked(f.store.read).mockResolvedValue(old);
    await f.session.prepare(); await f.session.record('Test', old.id);
    expect(f.store.save).toHaveBeenCalledWith(expect.objectContaining({ id: old.id, createdAt: old.createdAt,
      consentVersion: CONSENT_VERSION, sampleDurationMs: 20000 }), expect.any(AbortSignal), true);
    expect(f.store.remove).not.toHaveBeenCalled(); expect(old.embedding).toEqual([0, 0]);
    expect(f.session.getSnapshot().phase).toBe('saved');
  });
  it('does not overwrite a previous voice on incomplete capture, inference failure or deletion', async () => {
    for (const failure of ['incomplete', 'inference', 'deleted']) {
      const f = setup();
      if (failure === 'incomplete') f.recorder.record.mockResolvedValue(new Float32Array(128000));
      if (failure === 'inference') f.engine.compute.mockRejectedValue(new Error('Failed'));
      await f.session.prepare(); await f.session.record('Test', 'existing');
      expect(f.session.getSnapshot().phase).toBe('error');
      expect(f.store.save).not.toHaveBeenCalled(); expect(f.store.remove).not.toHaveBeenCalled();
    }
  });
});
