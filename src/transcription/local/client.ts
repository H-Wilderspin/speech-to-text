import type { AudioFrame } from '../../audio/streaming';
import type { LocalResponse, ReferenceVoice } from './types';
import { createSpeakerTrace, speakerDiagnosticsEnabled, speakerFailureStage } from '../diagnostics';

export interface LocalProcessor {
  request(data: { type: string; assets?: Record<string, Uint8Array<ArrayBuffer>>; references?: ReferenceVoice[]; frame?: AudioFrame; voiceCommands?: boolean }, signal: AbortSignal): Promise<LocalResponse>;
  dispose(): void;
}
export class LocalWorker implements LocalProcessor {
  private worker?: Worker;
  private sequence = 0;
  private pending?: (error: unknown) => void;
  private trace = createSpeakerTrace('worker');
  request(data: Parameters<LocalProcessor['request']>[0], signal: AbortSignal): Promise<LocalResponse> {
    signal.throwIfAborted();
    if (this.pending) { this.trace('busy-rejected'); return Promise.reject(new Error('Local speech processing is busy.')); }
    this.worker ??= new Worker(new URL('./local.worker.ts', import.meta.url), { type: 'module' });
    const worker = this.worker; const id = ++this.sequence;
    const started = performance.now();
    const sampled = data.type !== 'frame' || (data.frame?.startSample ?? 0) % 16000 === 0;
    if (sampled) this.trace(`${data.type}-request`, { request: id, startSample: data.frame?.startSample ?? null });
    return new Promise((resolve, reject) => {
      const waiting = speakerDiagnosticsEnabled() ? setTimeout(() => this.trace(`${data.type}-waiting`, {
        request: id, startSample: data.frame?.startSample ?? null, elapsedMs: Math.round(performance.now() - started),
      }), 1000) : undefined;
      const cleanup = () => { clearTimeout(timer); clearTimeout(waiting); signal.removeEventListener('abort', abort); this.pending = undefined; worker.onmessage = null; worker.onerror = null; };
      const fail = (error: unknown) => {
        this.trace(speakerFailureStage(error), { request: id, elapsedMs: Math.round(performance.now() - started) });
        cleanup(); worker.terminate(); this.worker = undefined; reject(error);
      };
      const abort = () => fail(signal.reason);
      const timer = setTimeout(() => fail(new Error('Local speech processing timed out. Switch to browser captions in Settings.')), data.type === 'prepare' || data.type === 'start' ? 90000 : 10000);
      this.pending = fail;
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = () => fail(new Error('This device could not run local listening. Switch to browser captions in Settings.'));
      worker.onmessage = (event: MessageEvent<LocalResponse>) => {
        if (event.data.id !== id) return;
        if (event.data.error) { fail(new Error(event.data.error)); return; }
        const elapsedMs = Math.round(performance.now() - started);
        if (sampled || elapsedMs >= 100) this.trace(`${data.type}-response`, { request: id, elapsedMs }, sampled ? 0 : 1000);
        if (event.data.diagnostics) this.trace('pipeline', { request: id, ...event.data.diagnostics },
          event.data.diagnostics.endpoint || data.type === 'finish' ? 0 : 1000);
        cleanup(); resolve(event.data);
      };
      try { worker.postMessage({ ...data, id, debugSpeakers: speakerDiagnosticsEnabled() }, data.assets ? Object.values(data.assets).map((asset) => asset.buffer) : []); }
      catch (error) { fail(error); }
    });
  }
  dispose() { this.pending?.(new DOMException('Local listening cancelled.', 'AbortError')); this.worker?.terminate(); this.worker = undefined; }
}
