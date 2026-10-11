import { createNativeExtractor, type NativeModule } from './native-extractor';

let extractor: ReturnType<typeof createNativeExtractor> | undefined;
let busy = false;

self.onmessage = async (event: MessageEvent<{ id: number; assets?: Uint8Array<ArrayBuffer>[]; samples?: Float32Array }>) => {
  const { id, assets, samples } = event.data;
  if (busy) { samples?.fill(0); self.postMessage({ id, error: 'Voice processing is already running.' }); return; }
  busy = true;
  try {
    if (assets) {
      if (assets.length !== 3 || assets.some((asset) => !(asset instanceof Uint8Array) || !asset.length)) throw new Error('Voice model assets are missing.');
      const [model, wasm, runtime] = assets;
      // Import the verified cached module directly; no secondary network request
      // or service-worker control is needed for offline model initialization.
      const runtimeUrl = URL.createObjectURL(new Blob([runtime!], { type: 'text/javascript' }));
      try {
        const { default: createModule } = await import(/* @vite-ignore */ runtimeUrl) as {
          default: (config: { wasmBinary: Uint8Array; locateFile: (name: string) => string; print: () => void; printErr: () => void }) => Promise<NativeModule>;
        };
        const module = await createModule({ wasmBinary: wasm!, locateFile: () => runtimeUrl, print: () => {}, printErr: () => {} });
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
