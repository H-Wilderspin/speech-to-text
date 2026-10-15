import type { TranscriptionEngine } from '../transcription/types';

export type WakeStatus = 'idle' | 'requesting' | 'held' | 'unavailable';

/** Best effort screen power management, independent of microphone/transcript state. */
export function watchListeningWakeLock(engine: TranscriptionEngine, onStatus: (status: WakeStatus) => void): () => void {
  let disposed = false;
  let pageHidden = false;
  let wanted = false;
  let generation = 0;
  let held: WakeLockSentinel | undefined;
  let removeReleaseListener: (() => void) | undefined;

  const release = (lock: WakeLockSentinel) => {
    // A browser may already have released it, or reject during document teardown.
    void lock.release().catch(() => { /* Must never interrupt listening. */ });
  };
  const drop = () => {
    removeReleaseListener?.();
    removeReleaseListener = undefined;
    const previous = held;
    held = undefined;
    if (previous) release(previous);
  };
  const acquire = async (requestGeneration: number) => {
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (disposed || !wanted || generation !== requestGeneration) {
        release(lock);
        return;
      }
      if (lock.released) { onStatus('unavailable'); return; }
      held = lock;
      const onRelease = () => {
        if (held !== lock) return;
        held = undefined;
        removeReleaseListener?.();
        removeReleaseListener = undefined;
        // Respect OS revocation; don't retry on every incoming caption.
        onStatus('unavailable');
      };
      lock.addEventListener('release', onRelease);
      removeReleaseListener = () => lock.removeEventListener('release', onRelease);
      onStatus('held');
    } catch {
      if (!disposed && wanted && generation === requestGeneration) onStatus('unavailable');
    }
  };
  const update = () => {
    const phase = engine.getSnapshot().phase;
    const next = !disposed && !pageHidden && document.visibilityState === 'visible'
      && (phase === 'requesting-permission' || phase === 'listening' || phase === 'restarting');
    if (next === wanted) return;
    wanted = next;
    generation += 1;
    drop();
    if (!wanted) { onStatus('idle'); return; }
    if (!navigator.wakeLock?.request) { onStatus('unavailable'); return; }
    onStatus('requesting');
    void acquire(generation);
  };
  const onPageHide = () => { pageHidden = true; update(); };
  const onPageShow = () => { pageHidden = false; update(); };
  const unsubscribe = engine.subscribe(update);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  update();
  return () => {
    disposed = true;
    generation += 1;
    unsubscribe();
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    drop();
  };
}
