import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionPhase, TranscriptionEngine } from '../transcription/types';
import { watchListeningWakeLock } from './listening-wake-lock';

class Lock extends EventTarget {
  released = false;
  release = vi.fn(async () => { this.released = true; this.dispatchEvent(new Event('release')); });
}

function setup() {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = new EventTarget();
  const lock = new Lock();
  const request = vi.fn<() => Promise<Lock>>().mockResolvedValue(lock);
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('navigator', { wakeLock: { request } });
  let phase: SessionPhase = 'idle';
  const listeners = new Set<() => void>();
  const engine: TranscriptionEngine = {
    unavailableReason: null, getSnapshot: () => ({ phase, segments: [], message: '' }),
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: vi.fn(), stop: vi.fn(), clear: vi.fn(), interrupt: vi.fn(), dispose: vi.fn(),
  };
  const status = vi.fn();
  const dispose = watchListeningWakeLock(engine, status);
  const setPhase = (next: SessionPhase) => { phase = next; listeners.forEach((listener) => listener()); };
  const visibility = (next: string) => { document.visibilityState = next; document.dispatchEvent(new Event('visibilitychange')); };
  return { document, window, lock, request, engine, status, dispose, setPhase, visibility };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => vi.unstubAllGlobals());

describe('listening screen wake lock', () => {
  it('holds one lock through permission, speech updates and Clear restart; releases on Stop', async () => {
    const h = setup();
    expect(h.request).not.toHaveBeenCalled();
    h.setPhase('requesting-permission'); await settle();
    h.setPhase('listening'); h.setPhase('listening'); h.setPhase('restarting'); h.setPhase('listening');
    expect(h.request).toHaveBeenCalledExactlyOnceWith('screen');
    expect(h.status).toHaveBeenLastCalledWith('held');
    h.setPhase('stopping');
    expect(h.lock.release).toHaveBeenCalledOnce();
    expect(h.status).toHaveBeenLastCalledWith('idle');
    h.dispose();
  });

  for (const ending of ['idle', 'error', 'dispose'] as const) it(`releases on ${ending}`, async () => {
    const h = setup(); h.setPhase('listening'); await settle();
    if (ending === 'dispose') h.dispose(); else { h.setPhase(ending); h.dispose(); }
    expect(h.lock.release).toHaveBeenCalledOnce();
  });

  it('releases late requests after Stop and cannot overwrite a new session', async () => {
    const h = setup();
    let resolve!: (value: Lock) => void;
    h.request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    h.setPhase('listening'); h.setPhase('stopping'); h.setPhase('listening'); await settle();
    const old = new Lock(); resolve(old); await settle();
    expect(old.release).toHaveBeenCalledOnce();
    expect(h.lock.release).not.toHaveBeenCalled();
    expect(h.status).toHaveBeenLastCalledWith('held'); h.dispose();
  });

  it('releases late requests after unmount without reporting state', async () => {
    const h = setup(); let resolve!: (value: Lock) => void;
    h.request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    h.setPhase('listening'); h.dispose(); h.status.mockClear(); resolve(h.lock); await settle();
    expect(h.lock.release).toHaveBeenCalledOnce(); expect(h.status).not.toHaveBeenCalled();
  });

  it('releases when hidden and only reacquires if listening is still active', async () => {
    const h = setup(); h.setPhase('listening'); await settle(); h.visibility('hidden');
    expect(h.lock.release).toHaveBeenCalledOnce();
    h.request.mockResolvedValue(new Lock()); h.visibility('visible'); await settle();
    expect(h.request).toHaveBeenCalledTimes(2);
    h.visibility('hidden'); h.setPhase('idle'); h.visibility('visible'); await settle();
    expect(h.request).toHaveBeenCalledTimes(2); expect(h.engine.start).not.toHaveBeenCalled(); h.dispose();
  });

  it('releases on pagehide even when visibility still reports visible', async () => {
    const h = setup(); h.setPhase('listening'); await settle(); h.window.dispatchEvent(new Event('pagehide'));
    h.setPhase('listening'); expect(h.lock.release).toHaveBeenCalledOnce(); expect(h.request).toHaveBeenCalledOnce();
    h.setPhase('idle'); h.window.dispatchEvent(new Event('pageshow')); expect(h.request).toHaveBeenCalledOnce(); h.dispose();
  });

  it('handles missing API and rejection without stopping speech or retrying every caption', async () => {
    const h = setup(); vi.stubGlobal('navigator', {}); h.setPhase('listening');
    expect(h.status).toHaveBeenLastCalledWith('unavailable');
    h.setPhase('idle'); vi.stubGlobal('navigator', { wakeLock: { request: h.request } });
    h.request.mockRejectedValue(new Error('Denied')); h.setPhase('listening'); await settle(); h.setPhase('listening');
    expect(h.status).toHaveBeenLastCalledWith('unavailable'); expect(h.request).toHaveBeenCalledOnce();
    expect(h.engine.stop).not.toHaveBeenCalled(); h.dispose();
  });

  it('respects OS revocation and retries on the next Listen', async () => {
    const h = setup(); h.setPhase('listening'); await settle(); await h.lock.release(); h.setPhase('listening');
    expect(h.status).toHaveBeenLastCalledWith('unavailable'); expect(h.request).toHaveBeenCalledOnce();
    h.request.mockResolvedValue(new Lock()); h.setPhase('idle'); h.setPhase('listening'); await settle();
    expect(h.status).toHaveBeenLastCalledWith('held'); expect(h.request).toHaveBeenCalledTimes(2); h.dispose();
  });
});
