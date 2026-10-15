import { startAudioCapture, streamingUnavailableReason, type AudioCapture } from '../../audio/streaming';
import { speakerModel } from '../../identification/model';
import type { ProfileStore } from '../../storage/profiles';
import { watchProfileChanges } from '../../storage/profile-changes';
import type { TranscriptSegment, TranscriptionSnapshot } from '../types';
import { loadLocalAssets } from './assets';
import { LocalWorker, type LocalProcessor } from './client';
import { createSpeakerTrace, speakerFailureStage } from '../diagnostics';
import type { LocalListeningEngine, LocalResponse, PreparationSnapshot, ReferenceVoice } from './types';

export class LocalEngine implements LocalListeningEngine {
  private snapshot: TranscriptionSnapshot = { phase: 'idle', message: 'Names are not prepared yet.', segments: [] };
  private preparation: PreparationSnapshot = { phase: 'idle', message: 'Names prepare automatically for saved speakers.' };
  private listeners = new Set<() => void>();
  private preparationOperation?: AbortController;
  private operation?: AbortController;
  private captureOperation?: AbortController;
  private processing?: Promise<LocalResponse>;
  private resetting?: Promise<void>;
  private capture?: AudioCapture;
  private history: TranscriptSegment[] = [];
  private sessionId = 0;
  private voiceStopped = false;
  private speakerStatus: string | undefined;
  private unwatchProfiles = () => {};
  private trace = createSpeakerTrace('local');
  constructor(private readonly appUrl: string, private readonly createStore: () => ProfileStore,
    private readonly processor: LocalProcessor = new LocalWorker(),
    private readonly captureAudio = startAudioCapture,
    private readonly assetsLoader = loadLocalAssets,
    private readonly voiceCommands = true) {}
  get unavailableReason() { return streamingUnavailableReason() ?? (this.preparation.phase !== 'ready' ? 'Names are not prepared yet.' : null); }
  getSnapshot = () => this.snapshot;
  getPreparationSnapshot = () => this.preparation;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.listeners.forEach((listener) => listener()); }
  private publish(phase: TranscriptionSnapshot['phase'], message: string, segments = this.snapshot.segments) {
    if (phase !== this.snapshot.phase) this.trace(phase, { session: this.sessionId });
    this.snapshot = { phase, message, sessionId: this.sessionId, segments, ...(this.speakerStatus ? { speakerStatus: this.speakerStatus } : {}) }; this.notify();
  }
  private setPreparation(phase: PreparationSnapshot['phase'], message: string) {
    this.trace(`preparation-${phase}`); this.preparation = { phase, message }; this.notify();
  }

  async prepare(cachedOnly = false) {
    if (this.preparationOperation || this.operation || this.resetting || this.preparation.phase === 'ready') return;
    const operation = new AbortController(); this.preparationOperation = operation;
    const timer = setTimeout(() => operation.abort(new Error('Local model preparation timed out. Retry on a faster connection; completed files will be reused.')), 600000);
    this.setPreparation('preparing', cachedOnly ? 'Loading the saved local speech model…' : 'Preparing local speech. Only missing files are downloaded…');
    try {
      const assets = await this.assetsLoader(this.appUrl, cachedOnly, operation.signal);
      operation.signal.throwIfAborted();
      await this.processor.request({ type: 'prepare', assets }, operation.signal); operation.signal.throwIfAborted();
      this.setPreparation('ready', 'Ready. Names are estimates; short, mixed or uncertain speech may remain Unknown.');
      this.publish('idle', 'Ready for local listening.');
    } catch (error) {
      if (this.preparationOperation === operation) {
        this.processor.dispose();
        this.setPreparation('error', error instanceof Error ? error.message : 'Local speech could not be prepared.');
      }
    } finally { clearTimeout(timer); if (this.preparationOperation === operation) this.preparationOperation = undefined; }
  }
  cancelPreparation() {
    const operation = this.preparationOperation; this.preparationOperation = undefined;
    operation?.abort(new DOMException('Preparation cancelled.', 'AbortError')); this.processor.dispose();
    this.setPreparation('idle', 'Preparation cancelled. Cached public model files remain available for retry.');
  }
  private request(data: Parameters<LocalProcessor['request']>[0], signal: AbortSignal) {
    const pending = this.processor.request(data, signal); this.processing = pending;
    const settled = () => { if (this.processing === pending) this.processing = undefined; };
    void pending.then(settled, settled);
    return pending;
  }
  private async loadReferences(operation: AbortController, sessionId: number) {
    const signal = operation.signal;
    const store = this.createStore(); const references: ReferenceVoice[] = [];
    try {
      const summaries = await store.list(); signal.throwIfAborted();
      if (summaries.length > 20) throw new Error('Experimental names support up to 20 saved speakers. Remove unused profiles first.');
      for (const summary of summaries) {
        const profile = await store.read(summary.id, signal);
        if (!profile) continue;
        try {
          signal.throwIfAborted();
          if (profile.modelVersion === speakerModel.version && profile.embedding.length === speakerModel.dimension) {
            references.push({ id: profile.id, name: profile.displayName, embedding: [...profile.embedding] });
          }
        } finally { profile.embedding.fill(0); }
      }
      if (!references.length) throw new Error('Record a voice profile in Settings to show names.');
      if (this.operation !== operation || this.sessionId !== sessionId) throw new DOMException('Stale session.', 'AbortError');
      this.trace('references-ready', { session: sessionId, profiles: references.length });
      await this.request({ type: 'start', sessionId, references, voiceCommands: this.voiceCommands }, signal);
    } finally { references.forEach((reference) => reference.embedding.fill(0)); store.close(); }
  }
  start(language: string, sessionId = this.sessionId + 1) {
    if (this.operation || this.resetting) return;
    if (this.unavailableReason) { this.publish('error', this.unavailableReason); return; }
    if (!language.startsWith('en')) { this.publish('error', 'Names currently support English. Live captions still work.'); return; }
    const operation = new AbortController(); this.operation = operation; this.sessionId = sessionId; this.voiceStopped = false; this.speakerStatus = undefined;
    const captureOperation = new AbortController(); this.captureOperation = captureOperation;
    this.trace('start', { session: this.sessionId });
    this.unwatchProfiles = watchProfileChanges(`speech-to-text-speakers:${new URL(this.appUrl).pathname}`, () => {
      this.interrupt(); this.publish('idle', 'Saved speakers changed. Stop and Listen again to update names.');
    });
    this.history = [...this.snapshot.segments];
    this.publish('requesting-permission', 'Starting local listening…');
    // Loading profiles runs alongside original-gesture microphone activation.
    const referencesReady = this.loadReferences(operation, sessionId);
    void referencesReady.catch(() => {});
    this.capture = this.captureAudio(captureOperation.signal, async (frame) => {
      await referencesReady; captureOperation.signal.throwIfAborted();
      if (this.operation !== operation || this.sessionId !== sessionId) return;
      const response = await this.request({ type: 'frame', sessionId, frame }, operation.signal);
      if (this.operation === operation && !operation.signal.aborted && this.sessionId === sessionId) this.accept(response, sessionId);
    }, () => {
      if (this.operation === operation && !captureOperation.signal.aborted && this.sessionId === sessionId) this.publish('listening', 'Listening locally. Names are estimates. Say “command stop” or tap Stop.');
    });
    const capture = this.capture;
    void (async () => {
      try {
        // Fail immediately if profile storage is unavailable, even during permission.
        await Promise.all([referencesReady, capture.done]); operation.signal.throwIfAborted();
        if (this.operation !== operation || this.sessionId !== sessionId) return;
        const response = await this.request({ type: 'finish', sessionId }, operation.signal); operation.signal.throwIfAborted();
        if (this.operation !== operation || this.sessionId !== sessionId) return;
        this.accept(response, sessionId);
        this.operation = undefined; this.capture = undefined;
        this.unwatchProfiles();
        this.publish('idle', this.voiceStopped ? 'Stopped by voice command.' : 'Stopped.');
      } catch (error) {
        if (this.operation === operation) {
          this.trace(speakerFailureStage(error), { session: this.sessionId });
          this.operation = undefined; this.capture = undefined; captureOperation.abort(); operation.abort(); this.processor.dispose();
          this.unwatchProfiles();
          this.setPreparation('idle', 'Local listening must be prepared again; saved model files will be reused.');
          this.publish('error', error instanceof Error ? error.message : 'Names unavailable. Live captions still work.', this.snapshot.segments.filter((segment) => segment.isFinal));
        }
      }
    })();
  }
  private accept(response: LocalResponse, sessionId: number) {
    if (sessionId !== this.sessionId || response.sessionId !== sessionId) return;
    if (response.speakerStatus !== undefined) this.speakerStatus = response.speakerStatus;
    if (response.segments) {
      const segments = [...this.history, ...response.segments.map((segment) => ({ ...segment, sessionId, revision: response.id, id: `${sessionId}:${segment.id}` }))];
      let excess = segments.reduce((sum, segment) => sum + segment.text.length, 0) - 100000;
      while (excess > 0 && segments.length) {
        const first = segments[0]!;
        if (first.text.length <= excess) { excess -= first.text.length; segments.shift(); }
        else { segments[0] = { ...first, text: first.text.slice(excess) }; excess = 0; }
      }
      this.publish(this.snapshot.phase, this.snapshot.message, segments);
    } else if (response.speakerStatus !== undefined) this.publish(this.snapshot.phase, this.snapshot.message);
    if (this.voiceCommands && response.commandStop && !this.voiceStopped) { this.voiceStopped = true; this.stop(); }
  }
  stop() {
    if (!this.operation || this.snapshot.phase === 'stopping') return;
    if (this.snapshot.phase === 'requesting-permission') { this.interrupt(); this.publish('idle', 'Microphone request cancelled.'); return; }
    this.publish('stopping', 'Stopping…'); this.capture?.stop();
  }
  interrupt() {
    if (!this.operation) return;
    const operation = this.operation; this.operation = undefined;
    this.unwatchProfiles();
    this.captureOperation?.abort(); operation.abort(new DOMException('Listening interrupted.', 'AbortError')); this.processor.dispose(); this.capture = undefined;
    this.setPreparation('idle', 'Reload the saved model in Settings to resume local listening.');
    this.publish('idle', 'Local listening paused because you left the app.', this.snapshot.segments.filter((segment) => segment.isFinal));
  }
  clear() { if (!this.operation) { this.history = []; this.speakerStatus = undefined; this.publish('idle', 'Text cleared.', []); } }
  resetSession(sessionId: number): Promise<void> {
    this.sessionId = sessionId;
    this.operation = undefined; this.captureOperation?.abort(); this.capture = undefined;
    this.unwatchProfiles(); this.history = []; this.speakerStatus = undefined;
    const pending = this.resetting ?? this.processing;
    // Release capture now. Let only the in-flight worker call finish, discard its
    // result, then reset native state in order without unloading model weights.
    const reset = (async () => {
      try {
        await pending;
        if (this.sessionId !== sessionId || this.preparation.phase !== 'ready') return;
        await this.request({ type: 'reset', sessionId }, new AbortController().signal);
      } catch {
        if (this.sessionId === sessionId) { this.processor.dispose(); this.setPreparation('idle', 'Reload saved models to resume names.'); }
      } finally {
        if (this.sessionId === sessionId) { this.resetting = undefined; this.publish('idle', 'Ready for names.', []); }
      }
    })();
    this.resetting = reset;
    this.publish('restarting', 'Resetting names…', []);
    return reset;
  }
  dispose() {
    this.sessionId++;
    this.resetting = undefined;
    this.interrupt(); this.cancelPreparation(); this.history = []; this.speakerStatus = undefined; this.snapshot = { phase: 'idle', message: 'Ready when you are.', segments: [] };
  }
}
