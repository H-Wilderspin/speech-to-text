import { speakerModel } from './model';

export const modelFiles = [
  { name: 'embedding.onnx', hash: speakerModel.sha256 },
  { name: 'speaker-runtime.wasm', hash: speakerModel.wasmSha256 },
  { name: 'speaker-runtime.mjs', hash: speakerModel.runtimeSha256 },
] as const;

export function modelCacheName(base: string) {
  return `speech-to-text-model:${new URL(base).href}:${speakerModel.version}`;
}

async function openCache(base: string): Promise<Cache | undefined> {
  try { return await globalThis.caches?.open(modelCacheName(base)); }
  catch { return undefined; } // Restricted/quota-limited browsers can still run online.
}

/** Presence check only. Every asset is independently hash-checked before use. */
export async function hasCachedModel(base: string): Promise<boolean> {
  try {
    const cache = await openCache(base);
    if (!cache) return false;
    const entries = await Promise.all(modelFiles.map(async (file) => {
      const response = await cache.match(new URL(file.name, base).href);
      return response?.headers.get('X-Voice-Asset-SHA256') === file.hash;
    }));
    return entries.every(Boolean);
  } catch { return false; }
}

export async function loadModelAsset(base: string, file: { name: string; hash: string }, cachedOnly: boolean): Promise<Uint8Array<ArrayBuffer>> {
  const url = new URL(file.name, base).href;
  const cache = await openCache(base);
  const verify = async (response: Response) => {
    const data = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', data);
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return actual === file.hash ? new Uint8Array(data) : undefined;
  };
  try {
    const response = await cache?.match(url);
    if (response) {
      const bytes = await verify(response);
      if (bytes) return bytes;
      await cache?.delete(url);
    }
  } catch { /* Treat unreadable cache entries as missing; never execute them. */ }
  if (cachedOnly) throw new Error('The saved voice model is unavailable or damaged. Prepare it again while online.');
  let response: Response;
  try { response = await fetch(url); }
  catch { throw new Error('Voice model download failed. Check the connection and retry.'); }
  if (!response.ok) throw new Error('Voice model download failed. Check the connection and retry.');
  const bytes = await verify(response);
  if (!bytes) throw new Error('The voice model download is incomplete or incompatible. Retry online.');
  try {
    await cache?.put(url, new Response(bytes, { headers: {
      'Content-Type': file.name.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream',
      'X-Voice-Asset-SHA256': file.hash,
    } }));
  } catch { /* Inference can proceed even if this browser cannot retain the files. */ }
  return bytes;
}
