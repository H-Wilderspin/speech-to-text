import type { EmbeddingEngine } from './model';

export class WorkerEmbeddingEngine implements EmbeddingEngine {
  private worker?: Worker;
  private ready = false;
  private sequence = 0;
  private rejectPending?: (reason: unknown) => void;
  constructor(private readonly assetsUrl: string) {}

  private request(data: { base?: string; samples?: Float32Array }, signal: AbortSignal): Promise<Float32Array | undefined> {
    signal.throwIfAborted();
    if (this.rejectPending) return Promise.reject(new Error('Voice processing is already running.'));
    this.worker ??= new Worker(new URL('./embedding.worker.ts', import.meta.url), { type: 'module' });
    const worker = this.worker;
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); this.rejectPending = undefined; worker.onmessage = null; worker.onerror = null; };
      const fail = (reason: unknown) => { cleanup(); this.ready = false; worker.terminate(); this.worker = undefined; reject(reason); };
      const abort = () => fail(signal.reason);
      const timer = setTimeout(() => fail(new Error('Voice processing timed out. Check the connection and retry.')), data.base ? 90000 : 30000);
      this.rejectPending = fail;
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = () => fail(new Error('This device could not run the voice model. You can still use anonymous captions.'));
      worker.onmessage = (event: MessageEvent<{ id: number; error?: string; embedding?: Float32Array }>) => {
        if (event.data.id !== id) return;
        if (event.data.error) { fail(new Error(event.data.error)); return; }
        cleanup(); resolve(event.data.embedding);
      };
      // Clone PCM so the caller can erase its own buffer regardless of worker completion.
      try { worker.postMessage({ id, ...data }); } catch (error) { fail(error); }
    });
  }
  async prepare(signal: AbortSignal) {
    signal.throwIfAborted();
    if (!this.ready) { await this.request({ base: this.assetsUrl }, signal); signal.throwIfAborted(); this.ready = true; }
  }
  async compute(samples: Float32Array, signal: AbortSignal) {
    if (!this.ready) throw new Error('Prepare the voice model before recording.');
    const embedding = await this.request({ samples }, signal);
    if (!(embedding instanceof Float32Array)) throw new Error('The voice model returned no voiceprint.');
    return embedding;
  }
  dispose() {
    this.rejectPending?.(new DOMException('Voice processing cancelled.', 'AbortError'));
    this.worker?.terminate(); this.worker = undefined; this.ready = false;
  }
}
