import type { VoiceRecorder } from '../../audio/recording';
import { speakerModel, type EmbeddingEngine } from '../../identification/model';
import { CONSENT_VERSION, normalizeEmbedding, type ProfileStore } from '../../storage/profiles';

type Phase = 'idle' | 'checking' | 'preparing' | 'ready' | 'recording' | 'processing' | 'saving' | 'saved' | 'error';
export type EnrolmentSnapshot = { phase: Phase; message: string; seconds: number };

export class EnrolmentSession {
  private snapshot: EnrolmentSnapshot = { phase: 'idle', message: 'Prepare the voice model, then record eight seconds of one person speaking.', seconds: 0 };
  private listeners = new Set<() => void>();
  private operation?: AbortController;
  private disposed = false;
  constructor(readonly recorder: VoiceRecorder, private readonly engine: EmbeddingEngine, private readonly store: ProfileStore) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(phase: Phase, message: string, seconds = 0) {
    if (this.disposed) return;
    this.snapshot = { phase, message, seconds }; this.listeners.forEach((listener) => listener());
  }
  private start(): AbortController | undefined {
    if (this.disposed || this.operation) return;
    const controller = new AbortController(); this.operation = controller; return controller;
  }
  async restore() {
    if (!this.engine.isCached || this.recorder.unavailableReason) return;
    const operation = this.start(); if (!operation) return;
    this.set('checking', 'Checking for a saved voice model…');
    try {
      const cached = await this.engine.isCached(); operation.signal.throwIfAborted();
      if (!cached) { this.set('idle', 'Prepare the voice model once, then record eight seconds of one person speaking.'); return; }
      this.set('preparing', 'Loading the saved voice model. No download is needed.');
      await this.engine.prepare(operation.signal, true); operation.signal.throwIfAborted();
      this.set('ready', 'Ready. Record eight seconds of clear speech in a quiet room.');
    } catch (error) { if (!operation.signal.aborted) this.set('idle', error instanceof Error ? error.message : 'The saved model could not be loaded. Prepare it again.'); }
    finally { if (this.operation === operation) this.operation = undefined; }
  }
  async prepare() {
    const operation = this.start(); if (!operation) return;
    this.set('preparing', 'Preparing the voice model. Only missing files are downloaded (up to 39 MB).');
    try {
      await this.engine.prepare(operation.signal); operation.signal.throwIfAborted();
      this.set('ready', 'Ready. Record eight seconds of clear speech in a quiet room.');
    } catch (error) { if (!operation.signal.aborted) this.set('error', error instanceof Error ? error.message : 'Could not prepare voice recording.'); }
    finally { if (this.operation === operation) this.operation = undefined; }
  }
  async record(displayName: string, consent: boolean) {
    if (this.disposed || this.operation) return;
    if (this.snapshot.phase !== 'ready' && this.snapshot.phase !== 'saved') return;
    if (!consent || !displayName.trim() || displayName.trim().length > 60) {
      this.set('ready', 'Enter a name and confirm the speaker’s consent before recording.'); return;
    }
    const operation = this.start(); if (!operation) return;
    let samples: Float32Array | undefined; let embedding: Float32Array | undefined; let normalized: number[] | undefined;
    const consentedAt = new Date().toISOString();
    this.set('recording', 'Allow microphone access if asked, then speak until recording finishes.');
    try {
      samples = await this.recorder.record(operation.signal, (seconds) => {
        if (!operation.signal.aborted) this.set('recording', `Recording: ${Math.floor(seconds)} of 8 seconds.`, seconds);
      });
      operation.signal.throwIfAborted();
      this.set('processing', 'Recording finished. Creating the voiceprint on this device…');
      embedding = await this.engine.compute(samples, operation.signal);
      operation.signal.throwIfAborted();
      if (embedding.length !== speakerModel.dimension) throw new Error('The voiceprint is incompatible with this model.');
      normalized = normalizeEmbedding(embedding);
      this.set('saving', 'Saving the consented voiceprint on this device…');
      await this.store.save({
        schemaVersion: 1, id: crypto.randomUUID(), displayName: displayName.trim(), createdAt: new Date().toISOString(),
        consentVersion: CONSENT_VERSION, consentedAt, modelVersion: speakerModel.version,
        sampleDurationMs: samples.length / 16, embedding: normalized,
      }, operation.signal);
      // A completed transaction wins a later cancellation; the saved list is authoritative.
      if (!operation.signal.aborted) this.set('saved', 'Voice profile saved on this device. Use Compare recordings to test it, or enable experimental name suggestions in Settings.');
    } catch (error) { if (!operation.signal.aborted) this.set('error', error instanceof Error ? error.message : 'Could not save this voice profile.'); }
    finally {
      samples?.fill(0); embedding?.fill(0); normalized?.fill(0);
      if (this.operation === operation) this.operation = undefined;
    }
  }
  cancel() {
    this.operation?.abort(new DOMException('Recording cancelled.', 'AbortError'));
    this.operation = undefined; this.engine.dispose();
    this.set('idle', 'Cancelled. Unfinished audio and voiceprints were discarded.');
  }
  dispose() { this.cancel(); this.disposed = true; this.listeners.clear(); }
}
