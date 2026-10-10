import { readFile } from 'node:fs/promises';

/** Local-only research asset loading shared by Node measurements. */
export async function loadPipelineRuntime() {
  const root = new URL('./private/pipeline-runtime/', import.meta.url);
  const asrRoot = new URL('./private/asr-runtime/', import.meta.url);
  const { default: createModule } = await import(new URL('pipeline-runtime.mjs', root));
  const { createOnlineRecognizer } = await import(new URL('asr-api.cjs', asrRoot));
  const wasm = await readFile(new URL('pipeline-runtime.wasm', root));
  const module = await createModule({ wasmBinary: wasm, print: () => {}, printErr: () => {} });
  const assets = {};
  for (const name of ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt']) assets[name] = await readFile(new URL(name, asrRoot));
  assets['silero_vad.onnx'] = await readFile(new URL('silero_vad.onnx', root));
  assets['embedding.onnx'] = await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url));
  return { module, createOnlineRecognizer, assets, wasm };
}
