import { loadModelAsset, modelFiles } from './model-cache';
import { createNativeExtractor, type NativeModule } from './native-extractor';

let extractor: ReturnType<typeof createNativeExtractor> | undefined;
let busy = false;

self.onmessage = async (event: MessageEvent<{ id: number; base?: string; cachedOnly?: boolean; samples?: Float32Array }>) => {
  const { id, base, cachedOnly = false, samples } = event.data;
  if (busy) { samples?.fill(0); self.postMessage({ id, error: 'Voice processing is already running.' }); return; }
  busy = true;
  try {
    if (base) {
      const location = new URL(base);
      if (location.origin !== self.location.origin) throw new Error('Voice model must load from this site.');
      const [model, wasm, runtime] = await Promise.all(modelFiles.map((file) => loadModelAsset(location.href, file, cachedOnly)));
      // Import the verified cached module directly; no secondary network request
      // or service-worker control is needed for offline model initialization.
      const runtimeUrl = URL.createObjectURL(new Blob([runtime!], { type: 'text/javascript' }));
      try {
        const { default: createModule } = await import(/* @vite-ignore */ runtimeUrl) as {
          default: (config: { wasmBinary: Uint8Array; locateFile: (name: string) => string; print: () => void; printErr: () => void }) => Promise<NativeModule>;
        };
        const module = await createModule({ wasmBinary: wasm!, locateFile: (name) => new URL(name, location).href, print: () => {}, printErr: () => {} });
        extractor?.close(); extractor = createNativeExtractor(module, model!);
      } finally { URL.revokeObjectURL(runtimeUrl); }
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
