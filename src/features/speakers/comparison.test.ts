import { describe, expect, it, vi } from 'vitest';
import { VoiceComparisonSession } from './comparison';
import { speakerModel } from '../../identification/model';
import { CONSENT_VERSION, type ProfileStore, type SpeakerProfile } from '../../storage/profiles';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function setup() {
  const samples = new Float32Array(128000).fill(.1);
  const embedding = new Float32Array(192); embedding[0] = 1;
  const reference: SpeakerProfile = { schemaVersion: 1, id: 'reference', displayName: 'Synthetic reference',
    consentVersion: CONSENT_VERSION, consentedAt: '2026-10-10T12:00:00Z', createdAt: '2026-10-10T12:00:00Z',
    modelVersion: speakerModel.version, sampleDurationMs: 8000, embedding: Array.from({ length: 192 }, (_, i) => i === 0 ? .8 : i === 1 ? .6 : 0) };
  const recorder = { record: vi.fn().mockResolvedValue(samples) };
  const engine = { prepare: vi.fn().mockResolvedValue(undefined), compute: vi.fn().mockResolvedValue(embedding), dispose: vi.fn() };
  const store: ProfileStore = { list: vi.fn(), read: vi.fn().mockResolvedValue(reference), save: vi.fn(), remove: vi.fn(), clear: vi.fn(), close: vi.fn() };
  const session = new VoiceComparisonSession(recorder, engine, store);
  return { session, recorder, engine, store, samples, embedding, reference };
}
describe('temporary consented voice comparisons', () => {
  it('requires preparation, a reference, a declared relationship and consent before recording', async () => {
    const f = setup(); await f.session.record('reference', 'same', true); await f.session.prepare();
    await f.session.record('', 'same', true); await f.session.record('reference', '', true); await f.session.record('reference', 'same', false);
    expect(f.recorder.record).not.toHaveBeenCalled(); expect(f.store.read).not.toHaveBeenCalled();
  });
  it('returns a score with the declared relationship, saves nothing and erases temporary buffers', async () => {
    const f = setup(); await f.session.prepare(); await f.session.record('reference', 'different', true);
    expect(f.session.getSnapshot().phase).toBe('complete');
    expect(f.session.getSnapshot().trials).toEqual([expect.objectContaining({ score: .8, relation: 'different', referenceId: 'reference', modelVersion: speakerModel.version, durationMs: 8000 })]);
    expect(f.store.save).not.toHaveBeenCalled(); expect(f.store.remove).not.toHaveBeenCalled();
    expect(f.samples.every((v) => v === 0)).toBe(true); expect(f.embedding.every((v) => v === 0)).toBe(true); expect(f.reference.embedding.every((v) => v === 0)).toBe(true);
    expect(Object.keys(f.session.getSnapshot().trials[0]!)).not.toContain('embedding');
    f.session.clearResults(); expect(f.session.getSnapshot().trials).toHaveLength(0);
  });
  it('checks a freshly read reference and refuses deleted or incompatible profiles', async () => {
    for (const invalid of [undefined, { modelVersion: 'old' }, { embedding: [1, 0] }]) {
      const f = setup(); vi.mocked(f.store.read).mockResolvedValue(invalid === undefined ? undefined : { ...f.reference, ...invalid });
      await f.session.prepare(); await f.session.record('reference', 'same', true);
      expect(f.session.getSnapshot().phase).toBe('error'); expect(f.engine.compute).not.toHaveBeenCalled();
      expect(f.samples.every((v) => v === 0)).toBe(true); expect(f.session.getSnapshot().trials).toHaveLength(0);
    }
  });
  it('cancels late recordings before reading profiles or starting inference', async () => {
    const f = setup(); const recording = deferred<Float32Array>(); f.recorder.record.mockReturnValue(recording.promise);
    await f.session.prepare(); const operation = f.session.record('reference', 'same', true); f.session.cancel(); recording.resolve(f.samples); await operation;
    expect(f.store.read).not.toHaveBeenCalled(); expect(f.engine.compute).not.toHaveBeenCalled(); expect(f.samples.every((v) => v === 0)).toBe(true);
  });
  it('discards inference delivered after cancellation and suppresses stale results', async () => {
    const f = setup(); const inference = deferred<Float32Array>(); f.engine.compute.mockReturnValue(inference.promise);
    await f.session.prepare(); const operation = f.session.record('reference', 'same', true);
    await vi.waitFor(() => expect(f.engine.compute).toHaveBeenCalledOnce());
    f.session.cancel(); inference.resolve(f.embedding); await operation;
    expect(f.session.getSnapshot()).toMatchObject({ phase: 'idle', trials: [] }); expect(f.reference.embedding.every((v) => v === 0)).toBe(true); expect(f.embedding.every((v) => v === 0)).toBe(true);
  });
  it('suppresses duplicate recording and stale preparation after disposal', async () => {
    const f = setup(); const prepared = deferred<void>(); f.engine.prepare.mockReturnValue(prepared.promise);
    const preparation = f.session.prepare(); await f.session.prepare(); f.session.dispose(); prepared.resolve(); await preparation;
    expect(f.engine.prepare).toHaveBeenCalledOnce(); expect(f.session.getSnapshot().phase).toBe('idle');
    const second = setup(); const capture = deferred<Float32Array>(); second.recorder.record.mockReturnValue(capture.promise);
    await second.session.prepare(); const recording = second.session.record('reference', 'same', true); await second.session.record('reference', 'same', true);
    expect(second.recorder.record).toHaveBeenCalledOnce(); second.session.cancel(); capture.resolve(second.samples); await recording;
  });
  it('bounds temporary results and permits another trial only after clearing them', async () => {
    const f = setup();
    f.recorder.record.mockImplementation(async () => new Float32Array(128000).fill(.1));
    f.engine.compute.mockImplementation(async () => new Float32Array(192).fill(.1));
    vi.mocked(f.store.read).mockImplementation(async () => ({ ...f.reference, embedding: [...f.reference.embedding] }));
    await f.session.prepare();
    for (let i = 0; i < 21; i++) await f.session.record('reference', 'same', true);
    expect(f.session.getSnapshot().trials).toHaveLength(20); expect(f.recorder.record).toHaveBeenCalledTimes(20);
    f.session.clearResults(); await f.session.record('reference', 'different', true);
    expect(f.session.getSnapshot().trials).toHaveLength(1); expect(f.recorder.record).toHaveBeenCalledTimes(21);
    f.session.dispose(); expect(f.session.getSnapshot().trials).toHaveLength(0);
  });
  it('rejects invalid inference values without publishing a score or changing a profile', async () => {
    const f = setup(); f.embedding.fill(0);
    await f.session.prepare(); await f.session.record('reference', 'same', true);
    expect(f.session.getSnapshot()).toMatchObject({ phase: 'error', trials: [] });
    expect(f.store.save).not.toHaveBeenCalled(); expect(f.reference.embedding.every((v) => v === 0)).toBe(true);
  });
});
