import { expect, it, vi } from 'vitest';
import { DelayedNamesEngine } from './engine';
import type { TranscriptionSnapshot } from '../types';
import type { LocalListeningEngine } from '../local/types';
import type { ProfileStore, ProfileSummary } from '../../storage/profiles';
import { speakerModel } from '../../identification/model';
import { notifyProfileChange } from '../../storage/profile-changes';

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
it('accepts follow-up browser words while names are pending and labels successive statements in one session', () => {
  const f = fixture();
  const next = { id: 'second', text: 'Tomorrow we will walk along the river together.', isFinal: false };
  f.browser.emit({ segments: [...words, next] });
  expect(f.engine.getSnapshot().segments.map((segment) => segment.text)).toEqual([phrase, next.text]);
  f.local.emit({ segments: evidence });
  expect(f.engine.getSnapshot().segments.at(-1)?.speakerId).toBeUndefined();
  f.local.emit({ segments: [...evidence, { ...next, id: 'second-local', isFinal: true,
    speakerId: 'a', speakerName: 'Test', speakerEstimated: true }] });
  expect(f.engine.getSnapshot().segments.every((segment) => segment.speakerId === 'a')).toBe(true);
  expect(f.engine.getSnapshot().segments.at(-1)).toMatchObject({ text: next.text, isFinal: false, speakerEvidenceFinal: true });
  expect(f.local.engine.start).toHaveBeenCalledOnce();
  expect(f.browser.engine.stop).not.toHaveBeenCalled(); f.engine.dispose();
});
it('reports which stage is waiting without revealing speech in the diagnostic', () => {
  const f = fixture();
  expect(f.engine.getSnapshot().speakerStatus).toBe('No local speech recognized yet.');
  f.local.emit({ segments: words });
  expect(f.engine.getSnapshot().speakerStatus).toBe('Speech received; no saved voice matched yet.');
  f.local.emit({ speakerStatus: 'Voice samples: 0/4 matched; 4 ambiguous.' });
  expect(f.engine.getSnapshot().speakerStatus).toBe('Voice samples: 0/4 matched; 4 ambiguous.');
  f.local.emit({ segments: evidence });
  expect(f.engine.getSnapshot().speakerStatus).toBe('Voice matched; waiting for matching words.');
  f.browser.emit({ segments: words.map((word) => ({ ...word, isFinal: false })) });
  expect(f.engine.getSnapshot().speakerStatus).toBe('Names are matching.');
  expect(f.engine.getSnapshot().segments[0]).toMatchObject({ isFinal: false, speakerEvidenceFinal: true, speakerId: 'a' });
  f.engine.dispose();
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
  expect(f.engine.getSnapshot().speakerStatus).toBe('No local speech recognized yet.');
  expect(f.engine.getSnapshot().segments).toHaveLength(2);
  expect(f.engine.getSnapshot().segments[0]!.speakerId).toBe('a'); expect(f.engine.getSnapshot().segments[1]!.speakerId).toBeUndefined();
  f.engine.stop(); f.engine.clear(); f.local.emit({ segments: evidence }); expect(f.engine.getSnapshot().segments).toEqual([]);
});
it('clears both panes while capture continues and late evidence cannot restore cleared text', () => {
  const f = fixture(); f.browser.emit({ segments: words });
  f.local.emit({ segments: evidence });
  expect(f.engine.getSnapshot().segments[0]?.speakerId).toBe('a');
  f.engine.clear();
  expect(f.engine.getSnapshot()).toMatchObject({ phase: 'listening', segments: [] });
  expect(f.local.engine.stop).not.toHaveBeenCalled(); expect(f.browser.engine.stop).not.toHaveBeenCalled();
  expect(f.local.engine.interrupt).not.toHaveBeenCalled();
  f.local.emit({ segments: evidence });
  expect(f.engine.getSnapshot().segments).toEqual([]);
  const next = { id: 'next', text: 'Another six clearly spoken words arrive here.', isFinal: true };
  f.browser.emit({ segments: [...words, next] });
  f.local.emit({ segments: [...evidence, { ...next, id: 'local-next', speakerId: 'a', speakerName: 'Alex', speakerEstimated: true }] });
  expect(f.engine.getSnapshot().segments).toHaveLength(1);
  expect(f.engine.getSnapshot().segments[0]).toMatchObject({ text: next.text, speakerId: 'a' });
  f.engine.stop();
  expect(f.engine.getSnapshot().segments).toHaveLength(1);
  f.engine.start('en-GB');
  expect(f.engine.getSnapshot().segments).toHaveLength(1);
  f.engine.clear(); expect(f.engine.getSnapshot().segments).toEqual([]);
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

function automaticFixture(rows: ProfileSummary[] = []) {
  const browser = source(); const local = source();
  const store: ProfileStore = { list: vi.fn(async () => rows), read: vi.fn(), save: vi.fn(), remove: vi.fn(), clear: vi.fn(), close: vi.fn() };
  const database = `automatic-test-${Math.random()}`;
  const engine = new DelayedNamesEngine(browser.engine, local.engine, { database, createStore: () => store });
  engine.subscribe(() => {});
  return { browser, local, store, database, engine };
}
const registered = [{ id: 'a', displayName: 'Test', modelVersion: speakerModel.version }] as ProfileSummary[];
it('automatically prepares registered profiles and starts names without a preference toggle', async () => {
  const f = automaticFixture(registered);
  await vi.waitFor(() => expect(f.local.engine.prepare).toHaveBeenCalledOnce());
  f.engine.start('en-GB'); expect(f.local.engine.start).toHaveBeenCalledOnce();
  f.browser.emit({ segments: words }); f.local.emit({ segments: evidence });
  expect(f.engine.getSnapshot().segments[0]?.speakerId).toBe('a'); f.engine.dispose();
});
it('keeps anonymous listening model-free and notices registration changes', async () => {
  const f = automaticFixture();
  await vi.waitFor(() => expect(f.store.close).toHaveBeenCalled());
  f.engine.start('en-GB'); f.browser.emit({ segments: words });
  expect(f.local.engine.prepare).not.toHaveBeenCalled(); expect(f.local.engine.start).not.toHaveBeenCalled();
  expect(f.engine.getSnapshot().segments).toEqual(words);
  vi.mocked(f.store.list).mockResolvedValue(registered); notifyProfileChange(f.database);
  await vi.waitFor(() => expect(f.local.engine.start).toHaveBeenCalledOnce());
  expect(f.browser.engine.start).toHaveBeenCalledOnce(); f.engine.dispose();
});
it('joins late preparation without resetting browser text, but Stop prevents late capture', async () => {
  for (const stop of [false, true]) {
    const f = automaticFixture(registered);
    let ready = false;
    f.local.engine.getPreparationSnapshot = () => ({ phase: ready ? 'ready' : 'preparing', message: 'Loading.' });
    await vi.waitFor(() => expect(f.local.engine.prepare).toHaveBeenCalled());
    f.engine.start('en-GB'); f.browser.emit({ segments: words });
    if (stop) f.engine.stop();
    ready = true; f.local.emit({ phase: 'idle' });
    await Promise.resolve();
    expect(f.local.engine.start).toHaveBeenCalledTimes(stop ? 0 : 1);
    expect(f.engine.getSnapshot().segments).toEqual(words); f.engine.dispose();
  }
});
it('does not prepare stale profiles after disposal and removes names after the last profile is deleted', async () => {
  const f = automaticFixture(registered);
  await vi.waitFor(() => expect(f.local.engine.prepare).toHaveBeenCalled());
  f.engine.start('en-GB'); f.browser.emit({ segments: words }); f.local.emit({ segments: evidence });
  vi.mocked(f.store.list).mockResolvedValue([]); notifyProfileChange(f.database);
  await vi.waitFor(() => expect(f.engine.getSnapshot().segments).toEqual(words));
  expect(f.browser.engine.stop).not.toHaveBeenCalled(); f.engine.dispose();
  const pending = automaticFixture();
  pending.engine.dispose(); await Promise.resolve();
  expect(pending.local.engine.prepare).not.toHaveBeenCalled();
});
it('releases name capture if speaker storage fails while browser captions continue', async () => {
  const f = automaticFixture(registered);
  await vi.waitFor(() => expect(f.local.engine.prepare).toHaveBeenCalled());
  f.engine.start('en-GB'); f.browser.emit({ segments: words }); f.local.emit({ segments: evidence });
  vi.mocked(f.store.list).mockRejectedValue(new Error('Storage failed.')); notifyProfileChange(f.database);
  await vi.waitFor(() => expect(f.engine.getSnapshot().notice).toContain('Speaker storage unavailable'));
  expect(f.engine.getSnapshot().segments).toEqual(words);
  expect(f.local.engine.interrupt).toHaveBeenCalled();
  expect(f.browser.engine.stop).not.toHaveBeenCalled(); f.engine.dispose();
});
