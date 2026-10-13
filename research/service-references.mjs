// Synthetic compatibility probe only; generated embeddings remain in ignored storage.
import { readFile, writeFile } from 'node:fs/promises';
import { createExtractor } from './speaker-inference.mjs';
import { readMonoWav } from './asr-streaming.mjs';
const root = new URL('./private/comparison/', import.meta.url);
const runtime = new URL('../public/local/v1/', import.meta.url);
const { default: createModule } = await import(new URL('pipeline-runtime.mjs', runtime));
const module = await createModule({ wasmBinary: await readFile(new URL('pipeline-runtime.wasm', runtime)), print: () => {}, printErr: () => {} });
const extractor = await createExtractor(module, await readFile(new URL('../public/speaker/v1/embedding.onnx', import.meta.url)));
const references = {};
try {
  for (const name of ['Hazel', 'Zira']) {
    const audio = readMonoWav(await readFile(new URL(`${name}-profile.wav`, root)));
    const embedding = extractor.compute(audio); const norm = Math.hypot(...embedding);
    references[name] = Array.from(embedding, (value) => value / norm); embedding.fill(0); audio.fill(0);
  }
  await writeFile(new URL('service-references.json', root), JSON.stringify(references));
} finally { extractor.close(); Object.values(references).forEach((vector) => vector.fill(0)); }
console.log('Synthetic WASM voiceprints prepared for native compatibility check.');
