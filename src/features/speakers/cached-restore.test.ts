import { describe, expect, it, vi } from 'vitest';
import { EnrolmentSession } from './enrolment';
import { VoiceComparisonSession } from './comparison';
import type { ProfileStore } from '../../storage/profiles';

describe.each([EnrolmentSession, VoiceComparisonSession])('%s saved-model restore', (Session) => {
  function setup(cached: boolean) {
    const recorder = { record: vi.fn() };
    const engine = { isCached: vi.fn().mockResolvedValue(cached), prepare: vi.fn().mockResolvedValue(undefined), compute: vi.fn(), dispose: vi.fn() };
    const store: ProfileStore = { list: vi.fn(), read: vi.fn(), save: vi.fn(), remove: vi.fn(), clear: vi.fn(), close: vi.fn() };
    return { session: new Session(recorder, engine, store), engine, recorder };
  }
  it('automatically prepares existing assets without permission or network permission', async () => {
    const { session, engine, recorder } = setup(true);
    await session.restore();
    expect(engine.prepare).toHaveBeenCalledWith(expect.any(AbortSignal), true);
    expect(session.getSnapshot().phase).toBe('ready');
    expect(recorder.record).not.toHaveBeenCalled();
  });
  it('waits for the explicit prepare action when assets are absent', async () => {
    const { session, engine } = setup(false); await session.restore();
    expect(engine.prepare).not.toHaveBeenCalled(); expect(session.getSnapshot().phase).toBe('idle');
  });
  it('does not load a cache check that completes after cancellation', async () => {
    const { session, engine } = setup(true);
    let resolve!: (cached: boolean) => void;
    engine.isCached.mockReturnValue(new Promise<boolean>((done) => { resolve = done; }));
    const restoring = session.restore(); session.cancel(); resolve(true); await restoring;
    expect(engine.prepare).not.toHaveBeenCalled(); expect(session.getSnapshot().phase).toBe('idle');
  });
});
