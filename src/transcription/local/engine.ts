import { startAudioCapture, streamingUnavailableReason, type AudioCapture } from '../../audio/streaming';
import { speakerModel } from '../../identification/model';
import type { ProfileStore } from '../../storage/profiles';
import { watchProfileChanges } from '../../storage/profile-changes';
import type { TranscriptSegment, TranscriptionSnapshot } from '../types';
import { loadLocalAssets } from './assets';
import { LocalWorker, type LocalProcessor } from './client';
import type { LocalListeningEngine, LocalResponse, PreparationSnapshot, ReferenceVoice } from './types';

export class LocalEngine implements LocalListeningEngine {
  private snapshot: TranscriptionSnapshot = { phase: 'idle', message: 'Prepare experimental names in Settings.', segments: [] };
  private preparation: PreparationSnapshot = { phase: 'idle', message: 'Prepare the local speech model to enable name suggestions.' };
  private listeners = new Set<() => void>();
  private preparationOperation?: AbortController;
  private operation?: AbortController;
  private capture?: AudioCapture;
  private history: TranscriptSegment[] = [];
  private sessionId = 0;
  private voiceStopped = false;
  private unwatchProfiles = () => {};
  constructor(private readonly appUrl: string, private readonly createStore: () => ProfileStore,
    private readonly processor: LocalProcessor = new LocalWorker(),
    private readonly captureAudio = startAudioCapture,
    private readonly assetsLoader = loadLocalAssets,
    private readonly voiceCommands = true) {}
  get unavailableReason() { return streamingUnavailableReason() ?? (this.preparation.phase !== 'ready' ? 'Prepare experimental names in Settings before listening.' : null); }
  getSnapshot = () => this.snapshot;
  getPreparationSnapshot = () => this.preparation;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.listeners.forEach((listener) => listener()); }
  private publish(phase: TranscriptionSnapshot['phase'], message: string, segments = this.snapshot.segments) {
    this.snapshot = { phase, message, segments }; this.notify();
  }
  private setPreparation(phase: PreparationSnapshot['phase'], message: string) { this.preparation = { phase, message }; this.notify(); }

  async prepare(cachedOnly = false) {
    if (this.preparationOperation || this.operation || this.preparation.phase === 'ready') return;
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
  private async loadReferences(signal: AbortSignal) {
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
      if (!references.length) throw new Error('Save a compatible voiceprint in Settings → Speakers before enabling names.');
      await this.processor.request({ type: 'start', references, voiceCommands: this.voiceCommands }, signal);
    } finally { references.forEach((reference) => reference.embedding.fill(0)); store.close(); }
  }
  start(language: string) {
    if (this.operation) return;
    if (this.unavailableReason) { this.publish('error', this.unavailableReason); return; }
    if (!language.startsWith('en')) { this.publish('error', 'Experimental names currently support English. Choose English or turn off name suggestions in Settings.'); return; }
    const operation = new AbortController(); this.operation = operation; this.sessionId++; this.voiceStopped = false;
    this.unwatchProfiles = watchProfileChanges(`speech-to-text-speakers:${new URL(this.appUrl).pathname}`, () => {
      this.interrupt(); this.publish('idle', 'Saved speakers changed. Prepare local listening again to use the current profiles.');
    });
    this.history = [...this.snapshot.segments];
    this.publish('requesting-permission', 'Starting local listening…');
    // Loading profiles runs alongside original-gesture microphone activation.
    const referencesReady = this.loadReferences(operation.signal);
    void referencesReady.catch(() => {});
    this.capture = this.captureAudio(operation.signal, async (frame) => {
      await referencesReady; operation.signal.throwIfAborted();
      const response = await this.processor.request({ type: 'frame', frame }, operation.signal);
      if (!operation.signal.aborted) this.accept(response);
    }, () => {
      if (!operation.signal.aborted) this.publish('listening', 'Listening locally. Names are estimates. Say “command stop” or tap Stop.');
    });
    const capture = this.capture;
    void (async () => {
      try {
        // Fail immediately if profile storage is unavailable, even during permission.
        await Promise.all([referencesReady, capture.done]); operation.signal.throwIfAborted();
        this.accept(await this.processor.request({ type: 'finish' }, operation.signal)); operation.signal.throwIfAborted();
        this.operation = undefined; this.capture = undefined;
        this.unwatchProfiles();
        this.publish('idle', this.voiceStopped ? 'Stopped by voice command.' : 'Stopped.');
      } catch (error) {
        if (this.operation === operation) {
          this.operation = undefined; this.capture = undefined; operation.abort(); this.processor.dispose();
          this.unwatchProfiles();
          this.setPreparation('idle', 'Local listening must be prepared again; saved model files will be reused.');
          this.publish('error', error instanceof Error ? error.message : 'Local listening failed. Switch to browser captions in Settings.', this.snapshot.segments.filter((segment) => segment.isFinal));
        }
      }
    })();
  }
  private accept(response: LocalResponse) {
    if (response.segments) {
      const segments = [...this.history, ...response.segments.map((segment) => ({ ...segment, id: `${this.sessionId}:${segment.id}` }))];
      let excess = segments.reduce((sum, segment) => sum + segment.text.length, 0) - 100000;
      while (excess > 0 && segments.length) {
        const first = segments[0]!;
        if (first.text.length <= excess) { excess -= first.text.length; segments.shift(); }
        else { segments[0] = { ...first, text: first.text.slice(excess) }; excess = 0; }
      }
      this.publish(this.snapshot.phase, this.snapshot.message, segments);
    }
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
    operation.abort(new DOMException('Listening interrupted.', 'AbortError')); this.processor.dispose(); this.capture = undefined;
    this.setPreparation('idle', 'Reload the saved model in Settings to resume local listening.');
    this.publish('idle', 'Local listening paused because you left the app.', this.snapshot.segments.filter((segment) => segment.isFinal));
  }
  clear() { if (!this.operation) { this.history = []; this.publish('idle', 'Text cleared.', []); } }
  dispose() {
    this.interrupt(); this.cancelPreparation(); this.history = []; this.snapshot = { phase: 'idle', message: 'Ready when you are.', segments: [] };
  }
}
