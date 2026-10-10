import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./private/pipeline-runtime/', import.meta.url);
await mkdir(root, { recursive: true });
const model = await readFile(new URL('../../sherpa-onnx/wasm/vad-asr/assets/silero_vad.onnx', import.meta.url));
await writeFile(new URL('silero_vad.onnx', root), model);
const manifest = { name: 'silero_vad.onnx', bytes: model.length, sha256: createHash('sha256').update(model).digest('hex'),
  source: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx' };
await writeFile(new URL('manifest.json', root), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
