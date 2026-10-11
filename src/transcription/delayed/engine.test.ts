import { expect, it, vi } from 'vitest';
import { DelayedNamesEngine } from './engine';
import type { TranscriptionSnapshot } from '../types';
import type { LocalListeningEngine } from '../local/types';

function source() {
  let snapshot: TranscriptionSnapshot = { phase: 'idle', message: 'Ready.', segments: [] };
  const listeners = new Set<() => void>();
  const emit = (value: Partial<TranscriptionSnapshot>) => { snapshot = { ...snapshot, ...value }; listeners.forEach((listener) => listener()); };
  const engine: LocalListeningEngine = {
    unavailableReason: null, getSnapshot: () => snapshot, subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getPreparationSnapshot: () => ({ phase: 'ready', message: 'Ready.' }), prepare: vi.fn(async () => {}), cancelPreparation: vi.fn(),
    start: vi.fn(() => emit({ phase: 'listening' })), stop: vi.fn(() => emit({ phase: 'idle', message: 'Stopped.' })),
    interrupt: vi.fn(() => emit({ phase: 'idle', message: 'Interrupted.' })), clear: vi.fn(() => emit({ segments: [] })),
    dispose: vi.fn(() => { listeners.clear(); snapshot = { phase: 'idle', message: 'Ready.', segments: [] }; }),
  };
  return { engine, emit };
}
const phrase = 'Please bring the blue book to the table.';
const words = [{ id: 'browser', text: phrase, isFinal: true }];
const evidence = [{ id: 'local', text: phrase, isFinal: true, speakerId: 'a', speakerName: 'Test', speakerEstimated: true }];
function fixture() {
  const browser = source(); const local = source(); const engine = new DelayedNamesEngine(browser.engine, local.engine);
  engine.subscribe(() => {}); engine.start('en-GB'); return { browser, local, engine };
}
it('shows browser words immediately, then estimates; local recognition never overwrites text', () => {
  const f = fixture(); f.browser.emit({ segments: words }); expect(f.engine.getSnapshot().segments).toEqual(words);
  f.local.emit({ segments: evidence }); expect(f.engine.getSnapshot().segments[0]).toMatchObject({ text: phrase, speakerId: 'a' });
  f.local.emit({ segments: [{ ...evidence[0]!, text: 'Incorrect local words that must never replace the browser text.' }] });
  expect(f.engine.getSnapshot().segments).toEqual(words);
});
it('keeps browser captions running when local processing fails', () => {
  const f = fixture(); f.local.emit({ phase: 'error', message: 'Too slow.' }); f.browser.emit({ segments: words });
  expect(f.engine.getSnapshot()).toMatchObject({ phase: 'listening', notice: expect.stringContaining('Too slow.'), segments: words });
  expect(f.browser.engine.stop).not.toHaveBeenCalled(); expect(f.browser.engine.interrupt).not.toHaveBeenCalled();
  f.browser.emit({ phase: 'error', message: 'The speech service could not connect.' });
  expect(f.engine.getSnapshot().message).toBe('The speech service could not connect.');
});
it('reports invalidated speaker processing without stopping the browser', () => {
  const f = fixture(); f.local.engine.getPreparationSnapshot = () => ({ phase: 'idle', message: 'Prepare.' });
  f.local.emit({ phase: 'idle', message: 'Saved speakers changed.' });
  expect(f.engine.getSnapshot()).toMatchObject({ phase: 'listening', notice: expect.stringContaining('Saved speakers changed.') });
  expect(f.browser.engine.stop).not.toHaveBeenCalled();
});
it('browser voice Stop releases local capture and accepts delayed labels while draining', () => {
  const f = fixture(); vi.mocked(f.local.engine.stop).mockImplementation(() => f.local.emit({ phase: 'stopping' }));
  f.browser.emit({ phase: 'idle', message: 'Stopped by voice command.', segments: words });
  expect(f.local.engine.stop).toHaveBeenCalledOnce(); expect(f.engine.getSnapshot().phase).toBe('stopping');
  f.local.emit({ phase: 'idle', segments: evidence });
  expect(f.engine.getSnapshot()).toMatchObject({ phase: 'idle', message: 'Stopped by voice command.' });
  expect(f.engine.getSnapshot().segments[0]!.speakerId).toBe('a');
});
it('isolates evidence across manual sessions and Clear', () => {
  const f = fixture(); f.browser.emit({ segments: words }); f.local.emit({ segments: evidence }); f.engine.stop();
  f.engine.start('en-GB'); f.browser.emit({ segments: words });
  expect(f.engine.getSnapshot().segments).toHaveLength(2);
  expect(f.engine.getSnapshot().segments[0]!.speakerId).toBe('a'); expect(f.engine.getSnapshot().segments[1]!.speakerId).toBeUndefined();
  f.engine.stop(); f.engine.clear(); f.local.emit({ segments: evidence }); expect(f.engine.getSnapshot().segments).toEqual([]);
});
it('retains browser captions with no prepared model and aborts local capture on browser failure', () => {
  const f = fixture(); f.browser.emit({ phase: 'error', message: 'Permission denied.' }); expect(f.local.engine.interrupt).toHaveBeenCalledOnce();
  f.local.engine.getPreparationSnapshot = () => ({ phase: 'idle', message: 'Prepare.' });
  f.engine.start('en-GB'); f.browser.emit({ segments: words }); expect(f.local.engine.start).toHaveBeenCalledTimes(1);
  expect(f.engine.getSnapshot()).toMatchObject({ phase: 'listening', segments: words });
});
it('can be disposed and reactivated without stale subscriptions or captions', () => {
  const f = fixture(); f.browser.emit({ segments: words }); f.engine.dispose();
  f.engine.subscribe(() => {}); f.engine.start('en-GB'); expect(f.engine.getSnapshot().segments).toEqual([]);
  f.browser.emit({ segments: words }); expect(f.engine.getSnapshot().segments).toEqual(words); f.engine.interrupt();
  expect(f.local.engine.interrupt).toHaveBeenCalled(); expect(f.browser.engine.interrupt).toHaveBeenCalled();
});
