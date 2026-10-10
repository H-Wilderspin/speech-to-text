import { speakerModel } from './model';
import { createNativeExtractor, type NativeModule } from './native-extractor';

let extractor: ReturnType<typeof createNativeExtractor> | undefined;
let busy = false;

async function verifiedBytes(url: URL, hash: string): Promise<Uint8Array> {
  let response: Response;
  try { response = await fetch(url); }
  catch { throw new Error('Voice model download failed. Check the connection and retry.'); }
  if (!response.ok) throw new Error('Voice model download failed. Check the connection and retry.');
  const data = await response.arrayBuffer();
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== hash) throw new Error('The voice model download is incomplete or incompatible. Retry online.');
  return new Uint8Array(data);
}

self.onmessage = async (event: MessageEvent<{ id: number; base?: string; samples?: Float32Array }>) => {
  const { id, base, samples } = event.data;
  if (busy) { samples?.fill(0); self.postMessage({ id, error: 'Voice processing is already running.' }); return; }
  busy = true;
  try {
    if (base) {
      const location = new URL(base);
      if (location.origin !== self.location.origin) throw new Error('Voice model must load from this site.');
      const [wasm, model] = await Promise.all([
        verifiedBytes(new URL('speaker-runtime.wasm', location), speakerModel.wasmSha256),
        verifiedBytes(new URL('embedding.onnx', location), speakerModel.sha256),
      ]);
      const runtimeUrl = new URL('speaker-runtime.mjs', location).href;
      const { default: createModule } = await import(/* @vite-ignore */ runtimeUrl) as {
        default: (config: { wasmBinary: Uint8Array; print: () => void; printErr: () => void }) => Promise<NativeModule>;
      };
      const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
      extractor?.close(); extractor = createNativeExtractor(module, model);
      self.postMessage({ id });
    } else {
      if (!extractor || !samples) throw new Error('Prepare the voice model before recording.');
      const embedding = extractor.compute(samples);
      self.postMessage({ id, embedding }, { transfer: [embedding.buffer] });
    }
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Voice processing failed. Retry or return to captions.' });
  } finally { samples?.fill(0); busy = false; }
};
