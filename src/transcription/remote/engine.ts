import { startAudioCapture, type AudioCapture } from '../../audio/streaming';
import type { ProfileStore, SpeakerProfile } from '../../storage/profiles';
import { speakerModel } from '../../identification/model';
import type { TranscriptSegment } from '../types';
import { createSpeakerTrace, speakerFailureStage } from '../diagnostics';
import { AudioWindows, type AudioWindow } from './windows';
import { checkService, sendWindow, serviceUrl, type Connection, type WindowResult } from './client';

type Run = { controller: AbortController; windows: AudioWindows; capture?: AudioCapture;
  queue: AudioWindow[]; pumping: boolean; ended: boolean; profiles: SpeakerProfile[]; prepared: Promise<void>; id: number };

/** Independent from Web Speech: HTTP/inference cannot back-pressure live captions. */
export class RemoteNames {
  private snapshot: { segments: readonly TranscriptSegment[]; status: string; pending: boolean } = {
    segments: [], status: 'PC comparison · English', pending: false,
  };
  private listeners = new Set<() => void>();
  private run?: Run;
  private serial = 0;
  private trace = createSpeakerTrace('remote');
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  constructor(private readonly createStore: () => ProfileStore,
    private readonly captureAudio = startAudioCapture, private readonly dispatch = sendWindow, private readonly check = checkService) {}

  private publish(changes: Partial<typeof this.snapshot>) {
    this.snapshot = { ...this.snapshot, ...changes }; this.listeners.forEach((listener) => listener());
  }

  start(connection: Connection, language: string) {
    this.cancel();
    try {
      serviceUrl(connection.url);
      if (!connection.key.trim()) throw new Error('Add the service access code in Settings.');
      if (!language.startsWith('en')) throw new Error('The PC comparison currently supports English.');
    } catch (error) { this.publish({ status: error instanceof Error ? error.message : 'Set the comparison service in Settings.' }); return; }
    const run: Run = { controller: new AbortController(), queue: [], pumping: false, ended: false,
      profiles: [], prepared: Promise.resolve(), id: ++this.serial,
      windows: new AudioWindows((window) => {
        if (run.queue.length >= 3) { window.samples.fill(0); throw new Error('PC processing fell behind. Restart Listen to retry names.'); }
        run.queue.push(window); this.trace('queued', { session: run.id, window: window.index, queued: run.queue.length });
        this.publish({ pending: true, status: 'Processing names on PC…' }); void this.pump(run, connection);
      }) };
    this.run = run; this.publish({ status: 'Collecting speech · first names after about 30 seconds', pending: true });
    run.prepared = Promise.all([this.loadProfiles(run), this.check(connection, run.controller.signal)]).then(() => {});
    void run.prepared.catch((error) => this.fail(run, error));
    run.capture = this.captureAudio(run.controller.signal, async (frame) => { run.windows.add(frame); });
    void run.capture.done.then(() => {
      if (this.run !== run) return;
      run.ended = true; run.windows.finish(); void this.pump(run, connection);
    }).catch((error) => this.fail(run, error));
  }

  private async loadProfiles(run: Run) {
    const store = this.createStore();
    try {
      const summaries = await store.list();
      if (!summaries.length) throw new Error('Add a speaker in Settings for the upper pane.');
      if (summaries.length > 16) throw new Error('The comparison supports up to 16 voice profiles.');
      for (const summary of summaries) {
        const profile = await store.read(summary.id, run.controller.signal);
        if (profile) {
          if (run.controller.signal.aborted || profile.modelVersion !== speakerModel.version) {
            profile.embedding.fill(0); throw new Error('Update your saved voice in Settings, then retry.');
          }
          run.profiles.push(profile);
        }
      }
      run.controller.signal.throwIfAborted();
      if (!run.profiles.length) throw new Error('Add a speaker in Settings for the upper pane.');
    } finally { store.close(); }
  }

  private async pump(run: Run, connection: Connection) {
    if (run.pumping || this.run !== run) return;
    run.pumping = true;
    try {
      await run.prepared;
      while (this.run === run && run.queue.length) {
        const window = run.queue.shift()!;
        try {
          this.trace('dispatch', { session: run.id, window: window.index, queued: run.queue.length });
          const result = await this.dispatch(connection, window, run.profiles, run.controller.signal);
          if (this.run !== run) return;
          const segments = this.toSegments(result, window, run);
          this.trace('completed', { session: run.id, window: window.index, words: result.words.length, assignedSegments: segments.length, processingMs: result.processingMs });
          this.publish({ segments: [...this.snapshot.segments, ...segments].slice(-2000),
            status: `${segments.length ? 'Names updated' : 'No saved voice matched'} · ${(result.processingMs / 1000).toFixed(1)}s processing` });
        } finally { window.samples.fill(0); }
      }
      if (this.run === run && run.ended) { this.release(run); this.run = undefined; this.publish({ pending: false }); }
    } catch (error) { this.fail(run, error); }
    finally { run.pumping = false; }
  }

  private toSegments(result: WindowResult, window: AudioWindow, run: Run): TranscriptSegment[] {
    const segments: TranscriptSegment[] = []; let previousKnown = false;
    for (const word of result.words) {
      const middle = window.startSample + (word.start + word.end) * 8000;
      if (middle < window.acceptFrom || middle >= window.acceptUntil) continue;
      const profile = run.profiles.find((profile) => profile.id === word.speakerId);
      if (!profile) { previousKnown = false; continue; }
      const startMs = window.startSample / 16 + word.start * 1000;
      const endMs = window.startSample / 16 + word.end * 1000;
      const last = segments.at(-1);
      if (previousKnown && last?.speakerId === profile.id && startMs - last.endMs! < 1000) { last.text += ` ${word.text}`; last.endMs = endMs; }
      else segments.push({ id: `pc-${run.id}-${window.index}-${segments.length}`, text: word.text, isFinal: true,
        startMs, endMs, speakerId: profile.id, speakerName: profile.displayName, speakerEstimated: true });
      previousKnown = true;
    }
    return segments;
  }

  private fail(run: Run, error: unknown) {
    if (this.run !== run) return;
    this.trace(speakerFailureStage(error), { session: run.id });
    this.cancel(); this.publish({ status: error instanceof Error ? error.message : 'PC comparison unavailable. Live captions can continue.' });
  }
  private release(run: Run) {
    run.controller.abort(); run.windows.erase();
    run.queue.splice(0).forEach((window) => window.samples.fill(0));
    run.profiles.splice(0).forEach((profile) => profile.embedding.fill(0));
  }
  stop() { this.run?.capture?.stop(); }
  cancel() { const run = this.run; this.run = undefined; if (run) this.release(run); this.publish({ pending: false }); }
  profilesChanged() { this.cancel(); this.publish({ segments: [], status: 'Speakers changed. Restart Listen to use them.' }); }
  clear() { this.cancel(); this.publish({ segments: [], status: 'PC comparison · English' }); }
  dispose() { this.cancel(); this.listeners.clear(); }
}
