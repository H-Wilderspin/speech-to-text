import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasCachedModel, loadModelAsset, modelCacheName, modelFiles } from './model-cache';

const base = 'https://example.test/speech-to-text/speaker/v1/';
const bytes = new Uint8Array([1, 2, 3, 4]);
async function fixture() {
  const entries = new Map<string, Response>();
  const cache = {
    match: vi.fn(async (url: string) => entries.get(url)?.clone()),
    put: vi.fn(async (url: string, response: Response) => { entries.set(url, response.clone()); }),
    delete: vi.fn(async (url: string) => entries.delete(url)),
  };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  const fetcher = vi.fn(async () => new Response(bytes)); vi.stubGlobal('fetch', fetcher);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { cache, entries, fetcher, file: { name: 'embedding.onnx', hash } };
}
afterEach(() => vi.unstubAllGlobals());

describe('verified persistent model files', () => {
  it('downloads once and loads the verified saved bytes without fetching again', async () => {
    const { file, fetcher } = await fixture();
    expect(await loadModelAsset(base, file, false)).toEqual(bytes);
    fetcher.mockRejectedValue(new Error('offline'));
    expect(await loadModelAsset(base, file, true)).toEqual(bytes);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects a corrupt cache without silently downloading during automatic restore', async () => {
    const { file, entries, fetcher } = await fixture();
    entries.set(new URL(file.name, base).href, new Response('damaged'));
    await expect(loadModelAsset(base, file, true)).rejects.toThrow('saved voice model');
    expect(fetcher).not.toHaveBeenCalled(); expect(entries.size).toBe(0);
    expect(await loadModelAsset(base, file, false)).toEqual(bytes);
  });
  it('does not retain an incompatible download', async () => {
    const { file, cache, fetcher } = await fixture(); fetcher.mockResolvedValue(new Response('wrong file'));
    await expect(loadModelAsset(base, file, false)).rejects.toThrow('incomplete or incompatible');
    expect(cache.put).not.toHaveBeenCalled();
  });
  it('allows online processing when cache storage is blocked or full', async () => {
    const { file, cache } = await fixture(); cache.put.mockRejectedValue(new Error('quota'));
    expect(await loadModelAsset(base, file, false)).toEqual(bytes);
    vi.stubGlobal('caches', { open: vi.fn().mockRejectedValue(new Error('denied')) });
    expect(await loadModelAsset(base, file, false)).toEqual(bytes);
    expect(await hasCachedModel(base)).toBe(false);
  });
  it('requires every current asset and scopes storage to the app/model version', async () => {
    const { entries } = await fixture();
    for (const file of modelFiles) {
      expect(await hasCachedModel(base)).toBe(false);
      entries.set(new URL(file.name, base).href, new Response(bytes, { headers: { 'X-Voice-Asset-SHA256': file.hash } }));
    }
    expect(await hasCachedModel(base)).toBe(true);
    expect(await hasCachedModel('https://example.test/another/speaker/v1/')).toBe(false);
    expect(modelCacheName(base)).not.toBe(modelCacheName('https://example.test/another/speaker/v1/'));
  });
});
