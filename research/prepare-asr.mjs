import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Only public model/software files are copied. Test speech is read in place by the runner.
const source = pathToFileURL(`${resolve(process.argv[2] ?? '../sherpa-onnx')}/`);
const output = new URL('./private/asr-runtime/', import.meta.url);
await mkdir(output, { recursive: true });
const modelRoot = 'wasm/vad-asr/assets/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17/';
const entries = [
  ['encoder-epoch-99-avg-1.int8.onnx', 'encoder.onnx'],
  ['decoder-epoch-99-avg-1.int8.onnx', 'decoder.onnx'],
  ['joiner-epoch-99-avg-1.int8.onnx', 'joiner.onnx'],
  ['tokens.txt', 'tokens.txt'], ['README.md', 'model-card.md'],
];
const manifest = [];
for (const [input, name] of entries) {
  const bytes = await readFile(new URL(modelRoot + input, source));
  await writeFile(new URL(name, output), bytes);
  manifest.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await copyFile(new URL('wasm/asr/sherpa-onnx-asr.js', source), new URL('asr-api.cjs', output));
const api = await readFile(new URL('wasm/asr/sherpa-onnx-asr.js', source), 'utf8');
await writeFile(new URL('asr-api.mjs', output), `${api}\nexport { createOnlineRecognizer };\n`);
await copyFile(new URL('LICENSE', source), new URL('sherpa-LICENSE.txt', output));
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
