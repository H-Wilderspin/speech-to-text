import files from '../../../local-assets.json';
import asr from '../../../local-asr-assets.json';
import { loadModelAsset, modelFiles } from '../../identification/model-cache';
import { assembleModel } from './chunked-model';

// Preserve the existing runtime/VAD/token cache. Only ASR weights are upgraded.
const sharedFiles = files.filter((file) => !['encoder.onnx', 'decoder.onnx', 'joiner.onnx'].includes(file.name));
export const additionalModelBytes = sharedFiles.reduce((total, file) => total + file.bytes, 0) + asr.encoder.bytes + asr.files.reduce((total, file) => total + file.bytes, 0);
export async function loadLocalAssets(appUrl: string, cachedOnly: boolean, signal: AbortSignal) {
  const base = new URL('local/v1/', appUrl).href;
  if (new URL(base).origin !== location.origin) throw new Error('Local models must load from this site.');
  let cache: Cache | null = null;
  try { cache = await caches.open(`speech-to-text-local:${base}:zipformer20m-v1`); } catch { /* Online operation can continue without storage. */ }
  signal.throwIfAborted();
  const assets: Record<string, Uint8Array<ArrayBuffer>> = {};
  // Sequential reads keep transient model-buffer memory bounded on phones.
  for (const file of sharedFiles) assets[file.name] = await loadModelAsset(base, file, cachedOnly, cache, signal);
  const asrBase = new URL('local/v2/', appUrl).href;
  let asrCache: Cache | null = null;
  try { asrCache = await caches.open(`speech-to-text-asr:${asrBase}:${asr.version}`); } catch { /* Explicit preparation can run without persistent cache. */ }
  try {
    assets['encoder.onnx'] = await assembleModel(asr.encoder, (part) => loadModelAsset(asrBase, part, cachedOnly, asrCache, signal), signal);
    for (const file of asr.files) assets[file.name] = await loadModelAsset(asrBase, file, cachedOnly, asrCache, signal);
  } catch (error) {
    if (cachedOnly && !signal.aborted) throw new Error('The upgraded speech model needs preparation in Settings. Saved voiceprints are kept.');
    throw error;
  }
  assets['embedding.onnx'] = await loadModelAsset(new URL('speaker/v1/', appUrl).href, modelFiles[0], cachedOnly, undefined, signal);
  return assets;
}
