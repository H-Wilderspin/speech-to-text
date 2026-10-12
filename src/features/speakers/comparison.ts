import type { VoiceRecorder } from '../../audio/recording';
import { speakerModel, type EmbeddingEngine } from '../../identification/model';
import { cosine } from '../../identification/similarity';
import type { ProfileStore, SpeakerProfile } from '../../storage/profiles';

export type DeclaredRelation = 'same' | 'different';
export type ComparisonTrial = {
  referenceName: string; referenceId: string; relation: DeclaredRelation; score: number;
  modelVersion: string; durationMs: number; processingMs: number;
};
type Phase = 'idle' | 'checking' | 'preparing' | 'ready' | 'recording' | 'processing' | 'complete' | 'error';
type Snapshot = { phase: Phase; message: string; seconds: number; trials: readonly ComparisonTrial[] };

/** Temporary evaluation only: records declared pair relationships, never identities. */
export class VoiceComparisonSession {
  private snapshot: Snapshot = { phase: 'idle', message: 'Prepare the voice model to compare a fresh recording.', seconds: 0, trials: [] };
  private listeners = new Set<() => void>();
  private operation?: AbortController;
  private disposed = false;
  constructor(readonly recorder: VoiceRecorder, private readonly engine: EmbeddingEngine, private readonly store: ProfileStore) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(phase: Phase, message: string, seconds = 0, trials = this.snapshot.trials) {
    if (this.disposed) return;
    this.snapshot = { phase, message, seconds, trials }; this.listeners.forEach((listener) => listener());
  }
  async restore() {
    if (this.disposed || this.operation || !this.engine.isCached || this.recorder.unavailableReason) return;
    const operation = new AbortController(); this.operation = operation;
    this.set('checking', 'Checking for a saved voice model…');
    try {
      const cached = await this.engine.isCached(); operation.signal.throwIfAborted();
      if (!cached) { this.set('idle', 'Prepare the voice model once to compare recordings.'); return; }
      this.set('preparing', 'Loading the saved voice model. No download is needed.');
      await this.engine.prepare(operation.signal, true); operation.signal.throwIfAborted();
      this.set('ready', 'Ready to record a comparison.');
    } catch (error) { if (!operation.signal.aborted) this.set('idle', error instanceof Error ? error.message : 'The saved model could not be loaded. Prepare it again.'); }
    finally { if (this.operation === operation) this.operation = undefined; }
  }
  async prepare() {
    if (this.disposed || this.operation) return;
    const operation = new AbortController(); this.operation = operation;
    this.set('preparing', 'Preparing the voice model. Only missing files are downloaded (up to 39 MB).');
    try { await this.engine.prepare(operation.signal); operation.signal.throwIfAborted(); this.set('ready', 'Ready to record a comparison.'); }
    catch (error) { if (!operation.signal.aborted) this.set('error', error instanceof Error ? error.message : 'Could not prepare comparison.'); }
    finally { if (this.operation === operation) this.operation = undefined; }
  }
  async record(referenceId: string, relation: DeclaredRelation | '') {
    if (this.disposed || this.operation || !['ready', 'complete'].includes(this.snapshot.phase)) return;
    if (!referenceId || (relation !== 'same' && relation !== 'different')) {
      this.set('ready', 'Choose a speaker and who is recording.'); return;
    }
    if (this.snapshot.trials.length >= 20) { this.set('complete', 'Twenty comparisons collected. Clear the results before recording more.'); return; }
    const operation = new AbortController(); this.operation = operation;
    let samples: Float32Array | undefined; let embedding: Float32Array | undefined; let reference: SpeakerProfile | undefined;
    this.set('recording', 'Speak naturally for eight seconds. This recording will not be saved.');
    try {
      // Preserve user activation by starting capture before any asynchronous storage read.
      samples = await this.recorder.record(operation.signal, (seconds) => {
        if (!operation.signal.aborted) this.set('recording', `Recording comparison: ${Math.floor(seconds)} of 8 seconds.`, seconds);
      });
      operation.signal.throwIfAborted(); this.set('processing', 'Comparing voices on this device…');
      reference = await this.store.read(referenceId, operation.signal);
      operation.signal.throwIfAborted();
      if (!reference) throw new Error('That saved profile was deleted. Choose another profile.');
      if (reference.modelVersion !== speakerModel.version || reference.embedding.length !== speakerModel.dimension) throw new Error('That profile uses an incompatible voice model. Record a new profile first.');
      const started = performance.now(); embedding = await this.engine.compute(samples, operation.signal);
      operation.signal.throwIfAborted();
      if (embedding.length !== speakerModel.dimension) throw new Error('The new voiceprint is incompatible with this model.');
      const score = cosine(reference.embedding, embedding);
      if (score === null) throw new Error('The comparison could not be measured. Try recording again.');
      const trial: ComparisonTrial = { referenceId, referenceName: reference.displayName, relation, score,
        modelVersion: speakerModel.version, durationMs: samples.length / 16, processingMs: Math.round(performance.now() - started) };
      this.set('complete', 'Comparison complete. No profile was changed.', 0, [...this.snapshot.trials, trial]);
    } catch (error) { if (!operation.signal.aborted) this.set('error', error instanceof Error ? error.message : 'Could not compare this recording.'); }
    finally {
      samples?.fill(0); embedding?.fill(0); reference?.embedding.fill(0);
      if (this.operation === operation) this.operation = undefined;
    }
  }
  clearResults() {
    if (this.disposed || this.operation) return;
    this.set(this.snapshot.phase === 'complete' ? 'ready' : this.snapshot.phase, 'Temporary comparison results cleared.', 0, []);
  }
  cancel() {
    this.operation?.abort(new DOMException('Comparison cancelled.', 'AbortError'));
    this.operation = undefined; this.engine.dispose();
    this.set('idle', 'Cancelled. Temporary recordings, voiceprints and comparison results were discarded.', 0, []);
  }
  dispose() { this.cancel(); this.disposed = true; this.listeners.clear(); }
}
