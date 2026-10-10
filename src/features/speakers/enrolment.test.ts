import { describe, expect, it, vi } from 'vitest';
import { EnrolmentSession } from './enrolment';
import type { ProfileStore } from '../../storage/profiles';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup() {
  const samples = new Float32Array(128000).fill(.1);
  const embedding = new Float32Array(192).fill(.1);
  const recorder = { record: vi.fn().mockResolvedValue(samples) };
  const engine = { prepare: vi.fn().mockResolvedValue(undefined), compute: vi.fn().mockResolvedValue(embedding), dispose: vi.fn() };
  const store: ProfileStore = { list: vi.fn().mockResolvedValue([]), read: vi.fn(), save: vi.fn().mockResolvedValue(undefined), remove: vi.fn(), clear: vi.fn(), close: vi.fn() };
  const session = new EnrolmentSession(recorder, engine, store);
  return { session, recorder, engine, store, samples, embedding };
}
describe('consented enrolment lifecycle', () => {
  it('requires preparation, a name and consent before touching the microphone', async () => {
    const { session, recorder } = setup();
    await session.record('Test', true); await session.prepare();
    await session.record('Test', false); await session.record(' ', true);
    expect(recorder.record).not.toHaveBeenCalled();
  });
  it('waits for durable save and erases audio and temporary embeddings afterward', async () => {
    const { session, store, samples, embedding } = setup();
    const save = deferred<void>(); vi.mocked(store.save).mockReturnValue(save.promise);
    await session.prepare(); const operation = session.record(' Test ', true);
    await vi.waitFor(() => expect(session.getSnapshot().phase).toBe('saving'));
    expect(session.getSnapshot().phase).not.toBe('saved'); save.resolve(); await operation;
    expect(session.getSnapshot().phase).toBe('saved');
    expect(samples.every((v) => v === 0)).toBe(true); expect(embedding.every((v) => v === 0)).toBe(true);
    expect(store.save).toHaveBeenCalledOnce();
  });
  it('discards capture that resolves after cancellation without starting inference', async () => {
    const { session, recorder, engine, store, samples } = setup();
    const capture = deferred<Float32Array>(); recorder.record.mockReturnValue(capture.promise);
    await session.prepare(); const operation = session.record('Test', true); session.cancel(); capture.resolve(samples); await operation;
    expect(engine.compute).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled();
    expect(samples.every((v) => v === 0)).toBe(true); expect(session.getSnapshot().phase).toBe('idle');
  });
  it('does not save an embedding delivered after cancellation or disposal', async () => {
    const { session, engine, store, embedding } = setup(); const inference = deferred<Float32Array>();
    engine.compute.mockReturnValue(inference.promise); await session.prepare(); const operation = session.record('Test', true);
    await vi.waitFor(() => expect(engine.compute).toHaveBeenCalled()); session.dispose(); inference.resolve(embedding); await operation;
    expect(store.save).not.toHaveBeenCalled(); expect(embedding.every((v) => v === 0)).toBe(true);
  });
  it('passes cancellation into storage and reports storage failure without claiming success', async () => {
    const { session, store, samples } = setup(); vi.mocked(store.save).mockRejectedValue(new Error('Storage full'));
    await session.prepare(); await session.record('Test', true);
    expect(session.getSnapshot()).toMatchObject({ phase: 'error', message: 'Storage full' });
    expect(samples.every((v) => v === 0)).toBe(true);
    expect(vi.mocked(store.save).mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });
  it('prevents duplicate operations and suppresses stale preparation results', async () => {
    const { session, engine } = setup(); const prepare = deferred<void>(); engine.prepare.mockReturnValue(prepare.promise);
    const operation = session.prepare(); await session.prepare(); session.cancel(); prepare.resolve(); await operation;
    expect(engine.prepare).toHaveBeenCalledOnce(); expect(session.getSnapshot().phase).toBe('idle');
  });
});
