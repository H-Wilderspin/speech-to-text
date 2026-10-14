import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserTranscriptionEngine } from './browser';
import type { BrowserRecognizer } from './types';

class FakeRecognizer implements BrowserRecognizer {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: BrowserRecognizer['onstart'] = null;
  onspeechstart: BrowserRecognizer['onspeechstart'] = null;
  onend: BrowserRecognizer['onend'] = null;
  onerror: BrowserRecognizer['onerror'] = null;
  onresult: BrowserRecognizer['onresult'] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  result(text: string, isFinal = true) {
    this.onresult?.({ results: [{ 0: { transcript: text, confidence: .9 }, isFinal, length: 1 }] });
  }
}

describe('browser recognition lifecycle', () => {
  let instances: FakeRecognizer[];
  let engine: BrowserTranscriptionEngine;
  const latest = () => instances[instances.length - 1]!;
  beforeEach(() => {
    vi.useFakeTimers();
    instances = [];
    engine = new BrowserTranscriptionEngine(() => {
      const instance = new FakeRecognizer(); instances.push(instance); return instance;
    });
  });
  afterEach(() => { engine.dispose(); vi.useRealTimers(); });

  it('starts from a gesture, configures recognition, and prevents duplicate capture', () => {
    engine.start('en-GB'); engine.start('en-GB');
    expect(instances).toHaveLength(1);
    expect(latest().start).toHaveBeenCalledOnce();
    expect(latest().lang).toBe('en-GB');
    expect(latest().continuous).toBe(true);
    expect(latest().interimResults).toBe(true);
    expect(engine.getSnapshot().phase).toBe('requesting-permission');
    latest().onstart?.();
    expect(engine.getSnapshot().phase).toBe('listening');
  });
  it('keeps a final result arriving during Stop, then releases callbacks', () => {
    engine.start('en-GB'); const native = latest(); native.onstart?.();
    native.result('unfinished', false); engine.stop();
    expect(engine.getSnapshot().phase).toBe('stopping');
    native.result('Finished.'); native.onend?.();
    expect(engine.getSnapshot().phase).toBe('idle');
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['Finished.']);
    expect(native.stop).toHaveBeenCalledOnce();
    expect(native.onresult).toBeNull();
    expect(native.onspeechstart).toBeNull();
  });
  describe('Android continuous result compatibility', () => {
    const androidResult = (texts: string[]) => latest().onresult?.({ results: texts.map((text) => ({
      0: { transcript: text, confidence: 0 }, isFinal: true, length: 1,
    })) });
    beforeEach(() => {
      engine.dispose();
      engine = new BrowserTranscriptionEngine(() => {
        const instance = new FakeRecognizer(); instances.push(instance); return instance;
      }, null, 'android-cumulative');
      engine.start('en-GB'); latest().onstart?.();
    });
    it('replaces revisions despite repeated speechstart events and commits the latest line once', () => {
      const native = latest();
      const texts = ['We', 'We are', 'We are hear', 'We are here.', 'We are here.'];
      for (let count = 1; count <= texts.length; count++) {
        native.onspeechstart?.(); androidResult(texts.slice(0, count));
        expect(engine.getSnapshot().segments).toEqual([{ id: '1:0', text: texts[count - 1], isFinal: false }]);
      }
      vi.advanceTimersByTime(15_000);
      expect(instances).toHaveLength(1); expect(native.continuous).toBe(true);
      native.onend?.();
      expect(engine.getSnapshot().segments).toEqual([{ id: '1:0', text: 'We are here.', isFinal: true }]);
      vi.advanceTimersByTime(0); latest().onstart?.();
      androidResult(['We are', 'We are here.']); latest().onend?.();
      expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['We are here.', 'We are here.']);
    });
    it('keeps words after a pause in a cumulative session and stops on the completed voice command', () => {
      androidResult(['First sentence.']); vi.advanceTimersByTime(15_000);
      androidResult(['First sentence.', 'First sentence. Next sentence. Command stop.']);
      expect(engine.getSnapshot().phase).toBe('listening');
      latest().onend?.(); vi.runAllTimers();
      expect(instances).toHaveLength(1);
      expect(engine.getSnapshot().phase).toBe('idle');
      expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['First sentence. Next sentence.']);
    });
    it('does not stop on a command that the provider corrects away', () => {
      androidResult(['command stop']);
      androidResult(['command stop', 'command stock']); latest().onend?.();
      expect(engine.getSnapshot().phase).toBe('listening');
      expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['command stock']);
    });
    it('commits the latest result during a successful button Stop', () => {
      androidResult(['Some', 'Some words']); engine.stop();
      androidResult(['Some', 'Some words', 'Some words finished.']); latest().onend?.();
      vi.runAllTimers(); expect(instances).toHaveLength(1);
      expect(engine.getSnapshot().segments).toEqual([{ id: '1:0', text: 'Some words finished.', isFinal: true }]);
    });
    it.each(['network', 'aborted', 'no-speech'])('does not confirm a partial after %s', (error) => {
      androidResult(['command stop']); latest().onerror?.({ error }); latest().onend?.();
      expect(engine.getSnapshot().segments).toEqual([]);
      expect(engine.getSnapshot().message).not.toBe('Stopped by voice command.');
    });
    it.each(['interrupt', 'dispose'] as const)('discards provisional text on %s and ignores late results', (action) => {
      const native = latest(); const late = native.onresult;
      androidResult(['unfinished']); engine[action]();
      late?.({ results: [{ 0: { transcript: 'stale', confidence: .9 }, length: 1, isFinal: true }] });
      expect(engine.getSnapshot().segments).toEqual([]); expect(native.abort).toHaveBeenCalledOnce();
    });
    it('does not confirm an unfinished guess when Stop times out', () => {
      androidResult(['unfinished']); engine.stop(); vi.advanceTimersByTime(2_000);
      expect(engine.getSnapshot().segments).toEqual([]); expect(latest().abort).toHaveBeenCalledOnce();
    });
  });
  it('keeps native capture through a pause and preserves a new sentence with the same opening', () => {
    engine.start('en-GB'); const native = latest(); native.onstart?.(); native.onspeechstart?.();
    native.result('We are here.');
    vi.advanceTimersByTime(15_000);
    expect(instances).toHaveLength(1);
    expect(native.stop).not.toHaveBeenCalled(); expect(native.abort).not.toHaveBeenCalled();
    native.onspeechstart?.();
    native.onresult?.({ results: ['We are here.', 'We are here again.'].map((text) => ({
      0: { transcript: text, confidence: .9 }, isFinal: true, length: 1,
    })) });
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['We are here.', 'We are here again.']);
    engine.stop(); native.onend?.();
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['We are here.', 'We are here again.']);
  });
  it('restarts a productive provider ending on the next task without adding a 200ms gap', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('First sentence.'); latest().onend?.();
    expect(instances).toHaveLength(1);
    vi.advanceTimersByTime(0);
    expect(instances).toHaveLength(2);
    expect(latest().continuous).toBe(true);
  });
  it('aborts when an engine never acknowledges Stop', () => {
    engine.start('en-GB'); const native = latest(); native.onstart?.();
    engine.stop(); vi.advanceTimersByTime(2_000);
    expect(native.abort).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().phase).toBe('idle');
  });
  it('can cancel permission and rejects late starts/results from that request', () => {
    engine.start('en-GB'); const native = latest();
    const lateStart = native.onstart; const lateResult = native.onresult;
    engine.stop(); engine.start('en-GB');
    lateStart?.(); lateResult?.({ results: [{ 0: { transcript: 'stale', confidence: 1 }, length: 1, isFinal: true }] });
    expect(engine.getSnapshot().segments).toEqual([]);
    expect(engine.getSnapshot().phase).toBe('requesting-permission');
    expect(native.abort).toHaveBeenCalledTimes(2);
  });
  it('ends cleanly on permission timeout', () => {
    engine.start('en-GB'); const native = latest(); vi.advanceTimersByTime(30_000);
    expect(native.abort).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().phase).toBe('error');
  });
  it.each(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported', 'unknown'])('recovers from %s without looping', (error) => {
    engine.start('en-GB'); const native = latest(); native.onstart?.(); native.result('Keep this.');
    native.onerror?.({ error });
    expect(engine.getSnapshot().phase).toBe('error');
    expect(engine.getSnapshot().segments).toHaveLength(1);
    expect(native.abort).toHaveBeenCalledOnce();
    vi.runAllTimers(); expect(instances).toHaveLength(1);
    engine.start('en-GB'); expect(instances).toHaveLength(2);
  });
  it('handles an external abort as an interruption', () => {
    engine.start('en-GB'); latest().onerror?.({ error: 'aborted' });
    expect(engine.getSnapshot().phase).toBe('idle');
  });
  it('keeps distinct ids across restarts, even for repeated phrases', () => {
    engine.start('en-GB'); latest().result('Yes.'); latest().onend?.();
    vi.advanceTimersByTime(200); latest().result('Yes.'); latest().onend?.();
    expect(engine.getSnapshot().segments.map((s) => s.id)).toEqual(['1:0', '2:0']);
  });
  it('automatically restarts after a natural end with the selected language', () => {
    engine.start('fr-FR'); latest().result('partial', false); latest().onend?.();
    expect(engine.getSnapshot().phase).toBe('listening');
    vi.advanceTimersByTime(200);
    expect(engine.getSnapshot().segments).toEqual([]);
    expect(instances).toHaveLength(2);
    expect(latest().lang).toBe('fr-FR');
  });
  it.each([true, false])('continues after silence, including missing end events (%s)', (ends) => {
    engine.start('en-GB'); const native = latest(); native.onstart?.();
    native.onerror?.({ error: 'no-speech' });
    if (ends) native.onend?.();
    else vi.advanceTimersByTime(2_000);
    vi.advanceTimersByTime(200);
    expect(instances).toHaveLength(2);
    expect(engine.getSnapshot().phase).toBe('listening');
  });
  it.each(['stop', 'interrupt', 'dispose'] as const)('cancels a scheduled restart on %s', (action) => {
    engine.start('en-GB'); latest().onstart?.(); latest().onend?.();
    engine[action](); vi.runAllTimers();
    expect(instances).toHaveLength(1);
    expect(engine.getSnapshot().phase).toBe('idle');
  });
  it('keeps Stop active while the restarted recognizer starts, then rejects late callbacks', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().onend?.();
    vi.advanceTimersByTime(200);
    const native = latest(); const lateEnd = native.onend;
    engine.stop(); native.onstart?.(); native.result('Final words.'); native.onend?.();
    lateEnd?.(); vi.runAllTimers();
    expect(instances).toHaveLength(2);
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['Final words.']);
    expect(engine.getSnapshot().phase).toBe('idle');
  });
  it('stops on confirmed command stop across cycles and removes the command', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('Keep this. Command'); latest().onend?.();
    vi.advanceTimersByTime(200); const native = latest(); native.onstart?.();
    native.result('stop', false);
    expect(engine.getSnapshot().phase).toBe('listening');
    native.result('STOP.'); vi.runAllTimers();
    expect(native.abort).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().message).toBe('Stopped by voice command.');
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['Keep this.']);
    expect(instances).toHaveLength(2);
  });
  it('keeps listening when the transcript exceeds its rolling retention limit', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('a'.repeat(99_990)); latest().onend?.();
    vi.advanceTimersByTime(200); latest().onstart?.(); latest().result('b'.repeat(30));
    expect(engine.getSnapshot().phase).toBe('listening');
    expect(engine.getSnapshot().segments.reduce((sum, segment) => sum + segment.text.length, 0)).toBe(100_000);
    expect(engine.getSnapshot().segments.at(-1)?.text).toBe('b'.repeat(30));
  });
  it('retains confirmed speech if a cumulative interim extension disappears', () => {
    engine.start('en-GB'); latest().onstart?.();
    latest().onresult?.({ results: [
      { 0: { transcript: 'We are', confidence: .9 }, isFinal: true, length: 1 },
      { 0: { transcript: 'We are here', confidence: .9 }, isFinal: false, length: 1 },
    ] });
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['We are here']);
    latest().onend?.();
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['We are']);
  });
  it('does not complete an old voice command across a manual stop and new Listen', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('command');
    engine.stop(); latest().onend?.();
    engine.start('en-GB'); latest().onstart?.(); latest().result('stop');
    expect(engine.getSnapshot().phase).toBe('listening');
    expect(engine.getSnapshot().segments.map((segment) => segment.text)).toEqual(['command', 'stop']);
  });
  it('backs off repeated empty cycles without accumulating timers or capture streams', () => {
    engine.start('en-GB'); latest().onstart?.();
    for (const delay of [200, 400, 800, 1_600, 2_000, 2_000]) {
      const count = instances.length;
      latest().onend?.();
      vi.advanceTimersByTime(delay - 1); expect(instances).toHaveLength(count);
      vi.advanceTimersByTime(1); expect(instances).toHaveLength(count + 1);
      latest().onstart?.();
    }
    engine.stop(); latest().onend?.(); vi.runAllTimers();
    expect(engine.getSnapshot().phase).toBe('idle');
  });
  it('aborts on interruption, retains finals and allows deletion when idle', () => {
    engine.start('en-GB'); const native = latest(); native.result('Confirmed.');
    expect(engine.getSnapshot().segments).toHaveLength(1);
    engine.interrupt(); expect(native.abort).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().message).toContain('left the app');
    engine.clear(); expect(engine.getSnapshot().segments).toEqual([]);
  });
  it.each(['standard', 'android-cumulative'] as const)('clears while %s capture continues through revisions, native end and voice Stop', (mode) => {
    engine.dispose();
    engine = new BrowserTranscriptionEngine(() => {
      const instance = new FakeRecognizer(); instances.push(instance); return instance;
    }, null, mode);
    engine.start('en-GB'); const native = latest(); native.onstart?.();
    native.result('We are', false); engine.clear();
    expect(engine.getSnapshot()).toMatchObject({ phase: 'listening', segments: [] });
    expect(native.stop).not.toHaveBeenCalled(); expect(native.abort).not.toHaveBeenCalled();
    native.result('We were ready to go.', true);
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['ready to go.']);
    engine.clear(); native.result('We were ready to go.', true);
    expect(engine.getSnapshot().segments).toEqual([]);
    native.onend?.(); vi.runOnlyPendingTimers(); latest().onstart?.();
    latest().result('The next sentence.', true);
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['The next sentence.']);
    latest().onend?.(); vi.runOnlyPendingTimers(); latest().onstart?.();
    latest().result('command stop', true);
    if (mode === 'android-cumulative') latest().onend?.();
    expect(engine.getSnapshot().phase).toBe('idle');
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['The next sentence.']);
  });
  it('keeps cumulative appended slots cleared without losing new words', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('We are'); engine.clear();
    latest().onresult?.({ results: ['We are', 'We are ready.'].map((text) => ({ 0: { transcript: text, confidence: .9 }, isFinal: true, length: 1 })) });
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['ready.']);
    engine.stop(); latest().onend?.();
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['ready.']);
  });
  it('clears by voice once, retains following words, and processes later commands in order', () => {
    engine.start('en-GB'); const native = latest(); native.onstart?.();
    native.result('Old text. Command clear', false);
    expect(engine.getSnapshot().segments[0]?.text).toContain('Old text');
    expect(engine.getSnapshot().clearRevision).toBe(0);
    const text = 'Old text. Command clear. A fresh sentence.';
    native.result(text);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'listening', clearRevision: 1 });
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['A fresh sentence.']);
    native.result(text);
    expect(engine.getSnapshot().clearRevision).toBe(1);
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['A fresh sentence.']);
    expect(native.stop).not.toHaveBeenCalled(); expect(native.abort).not.toHaveBeenCalled();
    native.result(`${text} Command clear. Keep this. Command stop. Discard this.`);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'idle', clearRevision: 2 });
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['Keep this.']);
  });
  it('handles a voice Clear split across native cycles and clears earlier manual sessions', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('Earlier session.'); engine.stop(); latest().onend?.();
    engine.start('en-GB'); latest().onstart?.(); latest().result('command'); latest().onend?.();
    vi.runOnlyPendingTimers(); latest().onstart?.(); latest().result('clear. New text.');
    expect(engine.getSnapshot()).toMatchObject({ phase: 'listening', clearRevision: 1 });
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['New text.']);
  });
  it('does not complete a voice Clear across separate manual sessions', () => {
    engine.start('en-GB'); latest().onstart?.(); latest().result('command'); engine.stop(); latest().onend?.();
    engine.start('en-GB'); latest().onstart?.(); latest().result('clear');
    expect(engine.getSnapshot().clearRevision).toBe(0);
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['command', 'clear']);
  });
  it('waits for Android native completion before voice Clear and resumes listening', () => {
    engine.dispose(); engine = new BrowserTranscriptionEngine(() => {
      const instance = new FakeRecognizer(); instances.push(instance); return instance;
    }, null, 'android-cumulative');
    engine.start('en-GB'); const native = latest(); native.onstart?.();
    native.result('Old words. Command clear. Fresh words.');
    expect(engine.getSnapshot().clearRevision).toBe(0);
    native.onend?.();
    expect(engine.getSnapshot()).toMatchObject({ phase: 'listening', clearRevision: 1 });
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['Fresh words.']);
    expect(native.stop).not.toHaveBeenCalled(); expect(native.abort).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers(); latest().onstart?.(); latest().result('More speech.'); latest().onend?.();
    expect(engine.getSnapshot().segments.map((s) => s.text)).toEqual(['Fresh words.', 'More speech.']);
  });
  it('disposes capture and listeners on unmount', () => {
    const listener = vi.fn(); engine.subscribe(listener);
    engine.start('en-GB'); const native = latest(); native.result('Discard on unmount.'); engine.dispose();
    expect(native.abort).toHaveBeenCalledOnce(); expect(native.onresult).toBeNull();
    expect(engine.getSnapshot().segments).toEqual([]);
    const calls = listener.mock.calls.length; vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(calls);
  });
  it('reports missing capability without requesting audio', () => {
    const unsupported = new BrowserTranscriptionEngine(null, 'Unsupported browser');
    unsupported.start('en-GB'); expect(unsupported.getSnapshot().message).toBe('Unsupported browser');
  });
  it('handles throwing start and stop implementations', () => {
    const native = new FakeRecognizer();
    const throwing = new BrowserTranscriptionEngine(() => native);
    native.start.mockImplementation(() => { throw new Error('native failure'); });
    throwing.start('en-GB'); expect(throwing.getSnapshot().phase).toBe('error');
    native.start.mockReset(); throwing.start('en-GB'); native.onstart?.();
    native.stop.mockImplementation(() => { throw new Error('native failure'); });
    throwing.stop(); expect(throwing.getSnapshot().phase).toBe('idle'); throwing.dispose();
  });
});
