import { createSharedPipeline } from './shared-pipeline.mjs';
let pipeline;
const bytes = async (path) => {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error('Pipeline assets could not load. Run the research preparation steps.');
  return new Uint8Array(await response.arrayBuffer());
};
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'prepare') {
      const [{ default: createModule }, { createOnlineRecognizer }, wasm] = await Promise.all([
        import('./private/pipeline-runtime/pipeline-runtime.mjs'), import('./private/asr-runtime/asr-api.mjs'), bytes('./private/pipeline-runtime/pipeline-runtime.wasm'),
      ]);
      const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
      const assets = {};
      for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) assets[name] = await bytes(`./private/asr-runtime/${name}`);
      assets['silero_vad.onnx'] = await bytes('./private/pipeline-runtime/silero_vad.onnx');
      assets['embedding.onnx'] = await bytes('../speaker/v1/embedding.onnx');
      pipeline = await createSharedPipeline(module, createOnlineRecognizer, assets);
      self.postMessage({ id, type: 'ready' }); return;
    }
    if (!pipeline) throw new Error('Prepare the pipeline first.');
    if (type === 'frame') self.postMessage({ id, ...pipeline.accept(data.frame) });
    else if (type === 'finish') { self.postMessage({ id, ...pipeline.finish() }); pipeline.close(); pipeline = undefined; }
    else throw new Error('Unknown pipeline request.');
  } catch (error) {
    pipeline?.close(); pipeline = undefined;
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : 'Local pipeline failed.' });
  } finally { data.frame?.samples?.fill(0); }
};
