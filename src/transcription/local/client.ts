import type { AudioFrame } from '../../audio/streaming';
import type { LocalResponse, ReferenceVoice } from './types';

export interface LocalProcessor {
  request(data: { type: string; assets?: Record<string, Uint8Array<ArrayBuffer>>; references?: ReferenceVoice[]; frame?: AudioFrame }, signal: AbortSignal): Promise<LocalResponse>;
  dispose(): void;
}
export class LocalWorker implements LocalProcessor {
  private worker?: Worker;
  private sequence = 0;
  private pending?: (error: unknown) => void;
  request(data: Parameters<LocalProcessor['request']>[0], signal: AbortSignal): Promise<LocalResponse> {
    signal.throwIfAborted();
    if (this.pending) return Promise.reject(new Error('Local speech processing is busy.'));
    this.worker ??= new Worker(new URL('./local.worker.ts', import.meta.url), { type: 'module' });
    const worker = this.worker; const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); this.pending = undefined; worker.onmessage = null; worker.onerror = null; };
      const fail = (error: unknown) => { cleanup(); worker.terminate(); this.worker = undefined; reject(error); };
      const abort = () => fail(signal.reason);
      const timer = setTimeout(() => fail(new Error('Local speech processing timed out. Switch to browser captions in Settings.')), data.type === 'prepare' || data.type === 'start' ? 90000 : 10000);
      this.pending = fail;
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = () => fail(new Error('This device could not run local listening. Switch to browser captions in Settings.'));
      worker.onmessage = (event: MessageEvent<LocalResponse>) => {
        if (event.data.id !== id) return;
        if (event.data.error) { fail(new Error(event.data.error)); return; }
        cleanup(); resolve(event.data);
      };
      try { worker.postMessage({ ...data, id }, data.assets ? Object.values(data.assets).map((asset) => asset.buffer) : []); }
      catch (error) { fail(error); }
    });
  }
  dispose() { this.pending?.(new DOMException('Local listening cancelled.', 'AbortError')); this.worker?.terminate(); this.worker = undefined; }
}
