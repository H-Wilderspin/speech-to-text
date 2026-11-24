import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchScreenWakeLock } from './screen-wake-lock';

class Lock extends EventTarget {
  released = false;
  release = vi.fn(async () => { this.released = true; this.dispatchEvent(new Event('release')); });
}

function setup({ hidden = false, missing = false, pending = false, denied = false } = {}) {
  const document = Object.assign(new EventTarget(), { visibilityState: hidden ? 'hidden' : 'visible' });
  const window = new EventTarget();
  const lock = new Lock();
  let resolve!: (lock: Lock) => void;
  const request = vi.fn<() => Promise<Lock>>().mockImplementation(() => pending
    ? new Promise(done => { resolve = done; }) : denied ? Promise.reject(new Error('Denied')) : Promise.resolve(lock));
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  vi.stubGlobal('navigator', missing ? {} : { wakeLock: { request } });
  const status = vi.fn();
  const dispose = watchScreenWakeLock(status);
  const visibility = (value: string) => { document.visibilityState = value; document.dispatchEvent(new Event('visibilitychange')); };
  return { window, lock, request, status, dispose, visibility, resolve: (lock: Lock) => resolve(lock) };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => vi.unstubAllGlobals());

describe('visible app screen wake lock', () => {
  it('acquires on opening without microphone activity and avoids duplicate requests', async () => {
    const h = setup(); await settle();
    h.visibility('visible'); h.window.dispatchEvent(new Event('pageshow'));
    expect(h.request).toHaveBeenCalledExactlyOnceWith('screen');
    expect(h.status).toHaveBeenLastCalledWith('held');
    expect(h.lock.release).not.toHaveBeenCalled();
    h.dispose(); expect(h.lock.release).toHaveBeenCalledOnce();
  });
  it('does not acquire in a hidden tab, releases when hidden, and reacquires on return', async () => {
    const h = setup({ hidden: true });
    expect(h.request).not.toHaveBeenCalled();
    h.visibility('visible'); await settle(); h.visibility('hidden');
    expect(h.lock.release).toHaveBeenCalledOnce();
    expect(h.status).toHaveBeenLastCalledWith('idle');
    h.request.mockResolvedValue(new Lock()); h.visibility('visible'); await settle();
    expect(h.request).toHaveBeenCalledTimes(2);
    expect(h.status).toHaveBeenLastCalledWith('held'); h.dispose();
  });
  it('releases on pagehide even while visibility reports visible and reacquires on pageshow', async () => {
    const h = setup(); await settle(); h.window.dispatchEvent(new Event('pagehide'));
    h.visibility('visible'); expect(h.lock.release).toHaveBeenCalledOnce();
    expect(h.request).toHaveBeenCalledOnce();
    h.request.mockResolvedValue(new Lock()); h.window.dispatchEvent(new Event('pageshow')); await settle();
    expect(h.status).toHaveBeenLastCalledWith('held'); h.dispose();
  });
  it('releases a late result from a hidden page without replacing its new lock', async () => {
    const h = setup({ pending: true }); h.visibility('hidden');
    const newer = new Lock(); h.request.mockResolvedValue(newer); h.visibility('visible'); await settle();
    h.resolve(h.lock); await settle();
    expect(h.lock.release).toHaveBeenCalledOnce(); expect(newer.release).not.toHaveBeenCalled();
    expect(h.status).toHaveBeenLastCalledWith('held'); h.dispose();
  });
  it('releases late requests after unmount without reporting state', async () => {
    const h = setup({ pending: true }); h.dispose(); h.status.mockClear(); h.resolve(h.lock); await settle();
    expect(h.lock.release).toHaveBeenCalledOnce(); expect(h.status).not.toHaveBeenCalled();
  });
  for (const failure of ['missing', 'denied'] as const) it(`handles ${failure} support without a retry loop`, async () => {
    const h = setup({ [failure]: true }); await settle();
    h.visibility('visible'); h.window.dispatchEvent(new Event('pageshow'));
    expect(h.status).toHaveBeenLastCalledWith('unavailable');
    expect(h.request).toHaveBeenCalledTimes(failure === 'missing' ? 0 : 1); h.dispose();
  });
  it('respects OS revocation and retries only after leaving and returning', async () => {
    const h = setup(); await settle(); await h.lock.release(); h.visibility('visible');
    expect(h.status).toHaveBeenLastCalledWith('unavailable'); expect(h.request).toHaveBeenCalledOnce();
    h.request.mockResolvedValue(new Lock()); h.visibility('hidden'); h.visibility('visible'); await settle();
    expect(h.status).toHaveBeenLastCalledWith('held'); expect(h.request).toHaveBeenCalledTimes(2); h.dispose();
  });
});
