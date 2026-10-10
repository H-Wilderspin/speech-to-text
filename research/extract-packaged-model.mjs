import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Read the file table, never execute the third-party JS wrapper.
const wrapper = resolve(process.argv[2] ?? '../hands-free-transcribe/public/sherpa/sherpa-onnx-wasm-main-speaker-diarization.js');
const glue = await readFile(wrapper, 'utf8');
const match = /filename:\s*"\/embedding\.onnx",\s*start:\s*(\d+),\s*end:\s*(\d+)/.exec(glue);
if (!match) throw new Error('No embedding.onnx entry found in the Emscripten package table.');
const data = await readFile(wrapper.replace(/\.js$/, '.data'));
const start = Number(match[1]); const end = Number(match[2]);
if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > data.length) {
  throw new Error('Invalid model bounds in the package table.');
}
const model = data.subarray(start, end);
const destination = new URL('./private/speaker-runtime/embedding.onnx', import.meta.url);
await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
await writeFile(destination, model);
console.log(JSON.stringify({ bytes: model.length, sha256: createHash('sha256').update(model).digest('hex') }, null, 2));
