import { describe, expect, it, vi } from 'vitest';
import { RemoteNames } from './engine';
import type { ProfileStore, SpeakerProfile } from '../../storage/profiles';
import { speakerModel } from '../../identification/model';
import type { AudioFrame } from '../../audio/streaming';
import type { WindowResult } from './client';

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function setup() {
  const done = deferred<void>(); let consume!: (frame: AudioFrame) => Promise<void>;
  const copies: SpeakerProfile[] = [];
  const createStore = () => ({ list: async () => [{ id: 'a' }], read: async () => {
    const profile = { id: 'a', displayName: 'Example', modelVersion: speakerModel.version, embedding: [1, 0] } as SpeakerProfile;
    copies.push(profile); return profile;
  }, close() {} } as unknown as ProfileStore);
  const capture = vi.fn((signal: AbortSignal, receiver: (frame: AudioFrame) => Promise<void>) => {
    consume = receiver; signal.addEventListener('abort', () => done.reject(new Error('cancelled')));
    return { done: done.promise, stop: vi.fn(() => done.resolve()) };
  });
  const response = deferred<WindowResult>(); const dispatch = vi.fn(() => response.promise);
  const engine = new RemoteNames(createStore, capture, dispatch, async () => {});
  const start = () => engine.start({ url: 'https://example.test', key: 'test-key' }, 'en-GB');
  const feed = async (startSample = 0, seconds = 24) => {
    try { await consume({ clockId: 'a', sampleRate: 16000, startSample, samples: new Float32Array(seconds * 16000).fill(.2) }); }
    catch (error) { done.reject(error as Error); throw error; }
    await settle();
  };
  return { engine, start, feed, response, dispatch, copies };
}

describe('independent PC names', () => {
  it('accepts more capture while inference is pending and drains Stop', async () => {
    const s = setup(); s.start(); await s.feed(); await s.feed(24 * 16000, 2);
    expect(s.dispatch).toHaveBeenCalledTimes(1);
    s.engine.stop(); await settle(); expect(s.engine.getSnapshot().pending).toBe(true);
    s.response.resolve({ index: 0, processingMs: 1000, words: [{ text: 'Hello.', start: 1, end: 2, speakerId: 'a' }] });
    await settle(); expect(s.dispatch).toHaveBeenCalledTimes(2); expect(s.engine.getSnapshot().pending).toBe(false);
    expect(s.engine.getSnapshot().segments[0]?.text).toBe('Hello.'); expect(s.copies[0]?.embedding).toEqual([0, 0]);
  });
  it('does not publish a cancelled response after Clear', async () => {
    const s = setup(); s.start(); await s.feed(); s.engine.clear();
    s.response.resolve({ index: 0, processingMs: 1, words: [{ text: 'Late', start: 1, end: 2, speakerId: 'a' }] });
    await settle(); expect(s.engine.getSnapshot().segments).toEqual([]); expect(s.copies[0]?.embedding).toEqual([0, 0]);
  });
  it('keeps deliberate repeats, excludes unknown words and does not merge across them', async () => {
    const s = setup(); s.start(); await s.feed();
    s.response.resolve({ index: 0, processingMs: 1, words: [
      { text: 'Yes', start: 1, end: 1.2, speakerId: 'a' }, { text: 'yes.', start: 1.3, end: 1.5, speakerId: 'a' },
      { text: 'Unknown', start: 1.6, end: 1.7 }, { text: 'Again', start: 1.8, end: 1.9, speakerId: 'a' },
    ] });
    await settle(); expect(s.engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['Yes yes.', 'Again']); s.engine.dispose();
  });
  it('fails visibly when queued audio exceeds its bound', async () => {
    const s = setup(); s.start(); await s.feed();
    await s.feed(24 * 16000, 60);
    await expect(s.feed(84 * 16000, 20)).rejects.toThrow(/fell behind/);
    await settle(); expect(s.engine.getSnapshot().status).toContain('fell behind');
    expect(s.engine.getSnapshot().pending).toBe(false);
    s.engine.dispose(); s.response.resolve({ index: 0, words: [], processingMs: 1 }); await settle();
    expect(s.engine.getSnapshot().segments).toEqual([]);
  });
  it('does not record or upload when the endpoint is absent', () => {
    const s = setup(); s.engine.start({ url: '', key: '' }, 'en-GB');
    expect(s.dispatch).not.toHaveBeenCalled(); expect(s.engine.getSnapshot().pending).toBe(false);
  });
});
