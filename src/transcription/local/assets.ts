import files from '../../../local-assets.json';
import { loadModelAsset, modelFiles } from '../../identification/model-cache';

export const additionalModelBytes = files.reduce((total, file) => total + file.bytes, 0);
export async function loadLocalAssets(appUrl: string, cachedOnly: boolean, signal: AbortSignal) {
  const base = new URL('local/v1/', appUrl).href;
  if (new URL(base).origin !== location.origin) throw new Error('Local models must load from this site.');
  let cache: Cache | null = null;
  try { cache = await caches.open(`speech-to-text-local:${base}:zipformer20m-v1`); } catch { /* Online operation can continue without storage. */ }
  signal.throwIfAborted();
  const assets: Record<string, Uint8Array<ArrayBuffer>> = {};
  // Sequential reads keep transient model-buffer memory bounded on phones.
  for (const file of files) assets[file.name] = await loadModelAsset(base, file, cachedOnly, cache, signal);
  assets['embedding.onnx'] = await loadModelAsset(new URL('speaker/v1/', appUrl).href, modelFiles[0], cachedOnly, undefined, signal);
  return assets;
}
