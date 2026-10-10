import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserTranscriptionEngine } from './browser';
import type { BrowserRecognizer } from './types';

class FakeRecognizer implements BrowserRecognizer {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: BrowserRecognizer['onstart'] = null;
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
    expect(latest().continuous && latest().interimResults).toBe(true);
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
  it.each(['no-speech', 'aborted'])('handles %s as a resumable interruption', (error) => {
    engine.start('en-GB'); latest().onerror?.({ error });
    expect(engine.getSnapshot().phase).toBe('idle');
  });
  it('keeps distinct ids across restarts, even for repeated phrases', () => {
    engine.start('en-GB'); latest().result('Yes.'); latest().onend?.();
    engine.start('en-GB'); latest().result('Yes.'); latest().onend?.();
    expect(engine.getSnapshot().segments.map((s) => s.id)).toEqual(['1:0', '2:0']);
  });
  it('does not automatically restart after a natural end', () => {
    engine.start('en-GB'); latest().result('partial', false); latest().onend?.(); vi.runAllTimers();
    expect(engine.getSnapshot().message).toContain('Tap Listen');
    expect(engine.getSnapshot().segments).toEqual([]);
    expect(instances).toHaveLength(1);
  });
  it('aborts on interruption, retains finals and allows deletion when idle', () => {
    engine.start('en-GB'); const native = latest(); native.result('Confirmed.');
    engine.clear(); expect(engine.getSnapshot().segments).toHaveLength(1);
    engine.interrupt(); expect(native.abort).toHaveBeenCalledOnce();
    expect(engine.getSnapshot().message).toContain('left the app');
    engine.clear(); expect(engine.getSnapshot().segments).toEqual([]);
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
