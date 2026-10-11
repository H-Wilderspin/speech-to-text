import { afterEach, expect, it, vi } from 'vitest';
import { loadModelAssets } from './model-cache';
import { WorkerEmbeddingEngine } from './worker-engine';

vi.mock('./model-cache', () => ({ hasCachedModel: vi.fn(), loadModelAssets: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

it('allows immediate retry after cancelling a pending model load, without reviving the old worker', async () => {
  vi.stubGlobal('location', { origin: 'https://example.test' });
  const worker = vi.fn(); vi.stubGlobal('Worker', worker);
  let resolve!: (assets: Uint8Array<ArrayBuffer>[]) => void;
  vi.mocked(loadModelAssets).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const engine = new WorkerEmbeddingEngine('https://example.test/speaker/v1/');
  const old = engine.prepare(new AbortController().signal, true);
  const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
  const oldSignal = vi.mocked(loadModelAssets).mock.calls[0]![2]!;
  engine.dispose(); expect(oldSignal.aborted).toBe(true);
  vi.mocked(loadModelAssets).mockRejectedValueOnce(new Error('New load attempted.'));
  await expect(engine.prepare(new AbortController().signal)).rejects.toThrow('New load attempted.');
  resolve([]); await rejected;
  expect(loadModelAssets).toHaveBeenCalledTimes(2); expect(worker).not.toHaveBeenCalled();
});
